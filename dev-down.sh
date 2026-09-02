#!/usr/bin/env bash
# Job Radar - Stop Dev Environment
# Usage: ./dev-down.sh

set -e

echo "Stopping Job Radar dev servers..."

# Kill background dev processes
pkill -f "pnpm dev" 2>/dev/null || true
pkill -f "tsx watch" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

echo "Dev servers stopped."
echo ""
echo "To also stop infrastructure (postgres, redis):"
echo "  docker compose down"
echo ""
echo "To stop everything including volumes:"
echo "  docker compose down -v"
