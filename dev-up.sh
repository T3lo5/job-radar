#!/usr/bin/env bash
# Job Radar - Dev Startup Script
# Usage: ./dev-up.sh [--reset] [--no-logs]
#   --reset   Reset database and start fresh
#   --no-logs Start without following logs

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() { echo -e "${BLUE}[dev-up]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; }

# Parse args
RESET=false
SHOW_LOGS=true
for arg in "$@"; do
  case $arg in
    --reset) RESET=true ;;
    --no-logs) SHOW_LOGS=false ;;
    *)
      echo "Unknown option: $arg"
      echo "Usage: ./dev-up.sh [--reset] [--no-logs]"
      exit 1
      ;;
  esac
done

cd "$(dirname "$0")"

echo ""
echo "========================================"
echo "  Job Radar - Dev Environment"
echo "========================================"
echo ""

# Check dependencies
log "Checking dependencies..."
command -v pnpm >/dev/null 2>&1 || { error "pnpm not found. Install with: npm i -g pnpm"; exit 1; }
command -v docker >/dev/null 2>&1 || { error "docker not found."; exit 1; }
command -v docker compose >/dev/null 2>&1 || { error "docker compose not found."; exit 1; }
success "Dependencies OK"

# Install pnpm dependencies if node_modules missing
if [ ! -d "node_modules" ]; then
  log "Installing dependencies..."
  pnpm install --frozen-lockfile 2>/dev/null || pnpm install
  success "Dependencies installed"
else
  success "Dependencies already installed"
fi

# Start infrastructure containers
log "Starting infrastructure (postgres, redis)..."
docker compose up -d postgres redis

# Wait for postgres
log "Waiting for postgres..."
RETRIES=30
until docker compose exec -T postgres pg_isready -U jobradar -d jobradar >/dev/null 2>&1; do
  RETRIES=$((RETRIES - 1))
  if [ $RETRIES -le 0 ]; then
    error "Postgres failed to start"
    docker compose logs postgres
    exit 1
  fi
  sleep 1
done
success "Postgres ready"

# Wait for redis
log "Waiting for redis..."
RETRIES=30
until docker compose exec -T redis redis-cli ping 2>/dev/null | grep -q PONG; do
  RETRIES=$((RETRIES - 1))
  if [ $RETRIES -le 0 ]; then
    error "Redis failed to start"
    docker compose logs redis
    exit 1
  fi
  sleep 1
done
success "Redis ready"

# Reset if requested
if [ "$RESET" = true ]; then
  warn "Resetting database..."
  cd apps/api
  pnpm db:reset --force --skip-generate 2>/dev/null || npx prisma migrate reset --force --skip-generate
  cd ../..
  success "Database reset"
fi

# Check/create .env with encryption key
if [ ! -f ".env" ]; then
  log ".env not found, creating from .env.example..."
  cp .env.example .env
  success ".env created"
fi

# Generate SETTINGS_ENCRYPTION_KEY if empty
if ! grep -q "^SETTINGS_ENCRYPTION_KEY=" .env || grep -q "^SETTINGS_ENCRYPTION_KEY=$" .env; then
  log "Generating SETTINGS_ENCRYPTION_KEY..."
  KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
  if grep -q "^SETTINGS_ENCRYPTION_KEY=" .env; then
    sed -i "s|^SETTINGS_ENCRYPTION_KEY=.*|SETTINGS_ENCRYPTION_KEY=$KEY|" .env
  else
    echo "SETTINGS_ENCRYPTION_KEY=$KEY" >> .env
  fi
  success "SETTINGS_ENCRYPTION_KEY generated"
fi
cd apps/api
pnpm db:deploy 2>/dev/null || npx prisma migrate deploy
cd ../..
success "Migrations applied"

# Seed database
log "Seeding database..."
cd apps/api
pnpm db:seed 2>/dev/null || npx tsx prisma/seed.ts 2>/dev/null || warn "Seed skipped (may already exist)"
cd ../..
success "Database seeded"

# Generate Prisma client
log "Generating Prisma client..."
cd apps/api
pnpm db:generate 2>/dev/null || npx prisma generate
cd ../..
success "Prisma client generated"

echo ""
echo "========================================"
echo "  Starting Dev Servers"
echo "========================================"
echo ""

# Cleanup function
cleanup() {
  echo ""
  warn "Shutting down..."
  # Kill background jobs
  jobs -p | xargs -r kill 2>/dev/null || true
  success "Stopped"
  exit 0
}
trap cleanup INT TERM

# Start API in background
log "Starting API (http://localhost:3001)..."
cd apps/api
(set -a; source ../../.env 2>/dev/null; set +a; pnpm dev) > /tmp/jobradar-api.log 2>&1 &
API_PID=$!
cd ../..

# Start Web in background
log "Starting Web (http://localhost:5173)..."
cd apps/web
(set -a; source ../../.env 2>/dev/null; set +a; pnpm dev) > /tmp/jobradar-web.log 2>&1 &
WEB_PID=$!
cd ../..

# Wait for servers to be ready
log "Waiting for API to be ready..."
RETRIES=30
until curl -s http://localhost:3001/health >/dev/null 2>&1; do
  RETRIES=$((RETRIES - 1))
  if [ $RETRIES -le 0 ]; then
    error "API failed to start"
    tail -20 /tmp/jobradar-api.log
    kill $API_PID $WEB_PID 2>/dev/null || true
    exit 1
  fi
  sleep 1
done
success "API ready (PID: $API_PID)"

log "Waiting for Web to be ready..."
RETRIES=30
until curl -s http://localhost:5173 >/dev/null 2>&1; do
  RETRIES=$((RETRIES - 1))
  if [ $RETRIES -le 0 ]; then
    error "Web failed to start"
    tail -20 /tmp/jobradar-web.log
    kill $API_PID $WEB_PID 2>/dev/null || true
    exit 1
  fi
  sleep 1
done
success "Web ready (PID: $WEB_PID)"

echo ""
echo "========================================"
echo "  Job Radar is running!"
echo "========================================"
echo ""
echo -e "  API:  ${GREEN}http://localhost:3001${NC}"
echo -e "  Web:  ${GREEN}http://localhost:5173${NC}"
echo -e "  Docs: ${GREEN}http://localhost:3001/health${NC}"
echo ""
echo "  Press Ctrl+C to stop all servers"
echo ""

# Show logs
if [ "$SHOW_LOGS" = true ]; then
  echo "========================================"
echo "  Logs (Ctrl+C to stop)"
echo "========================================"
  echo ""

  # Create a combined log view
  tail -f /tmp/jobradar-api.log /tmp/jobradar-web.log 2>/dev/null | while IFS= read -r line; do
    if echo "$line" | grep -q "jobradar-api.log"; then
      continue
    fi
    if echo "$line" | grep -q "jobradar-web.log"; then
      continue
    fi
    # Color API logs blue, Web logs green
    if echo "$line" | grep -qE "(api|fastify|bullmq|prisma)"; then
      echo -e "${BLUE}[api]${NC} $line"
    elif echo "$line" | grep -qE "(vite|web|react)"; then
      echo -e "${GREEN}[web]${NC} $line"
    else
      echo -e "${YELLOW}[app]${NC} $line"
    fi
  done
else
  # Wait for user to Ctrl+C
  wait
fi
