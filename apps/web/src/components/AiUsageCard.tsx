import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle } from 'lucide-react';
import { adminApi, type AiRunType } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { EmptyState } from './empty-state';

const PERIODS = [
  { days: 7, label: '7 dias' },
  { days: 30, label: '30 dias' },
  { days: 90, label: '90 dias' },
];

const TYPE_LABELS: Record<AiRunType, string> = {
  CV_PARSE: 'Leitura de CV',
  REQUIREMENT_EXTRACT: 'Extração de requisitos',
  MATCH_EXPLAIN: 'Explicação de match',
  JOB_ANALYZE: 'Análise de vaga',
  CV_OPTIMIZE: 'Otimização de CV',
  SUMMARIZE: 'Resumo',
  OTHER: 'Outra operação',
};

/**
 * Custos abaixo de 1 centavo arredondar para duas casas vira sempre "0,00",
 * que é pior que impreciso: parece que não houve gasto. Por isso o corte em
 * 4 casas nos valores pequenos.
 */
function formatCost(usd: number): string {
  if (usd === 0) return 'US$ 0,00';
  if (usd < 0.01) return `US$ ${usd.toFixed(4).replace('.', ',')}`;
  return `US$ ${usd.toFixed(2).replace('.', ',')}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace('.', ',')}k`;
  return String(n);
}

export function AiUsageCard() {
  const [days, setDays] = useState(30);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['ai-usage', days],
    queryFn: () => adminApi.getAiUsage(days),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Uso de IA
          </span>
          <div className="flex gap-1">
            {PERIODS.map((p) => (
              <Button
                key={p.days}
                size="sm"
                variant={days === p.days ? 'primary' : 'outline'}
                onClick={() => setDays(p.days)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : isError ? (
          <p className="text-sm text-error">
            Não foi possível ler o histórico de IA:{' '}
            {error instanceof Error ? error.message : 'erro desconhecido'}
          </p>
        ) : !data || data.totals.calls === 0 ? (
          <EmptyState
            icon={<Activity className="h-6 w-6" />}
            title="Nenhuma chamada de IA neste período"
            description="Assim que o sistema ler um CV, extrair requisitos ou otimizar uma candidatura, o custo aparece aqui."
          />
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <Metric label="Custo" value={formatCost(data.totals.costUsd)} highlight />
              <Metric label="Chamadas" value={String(data.totals.calls)} />
              <Metric
                label="Tokens"
                value={`${formatTokens(data.totals.promptTokens + data.totals.completionTokens)}`}
              />
              <Metric
                label="Modelos"
                value={data.models.length === 1 ? data.models[0] : String(data.models.length)}
              />
            </div>

            <h4 className="text-sm font-medium mb-2">Por operação</h4>
            <ul className="space-y-2">
              {data.byType.map((row) => {
                const share =
                  data.totals.costUsd > 0 ? (row.costUsd / data.totals.costUsd) * 100 : 0;
                return (
                  <li key={row.type}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span>{TYPE_LABELS[row.type] ?? row.type}</span>
                      <span className="text-muted-foreground">
                        {formatCost(row.costUsd)} · {row.calls}x
                      </span>
                    </div>
                    <div className="h-1.5 mt-1 rounded-full bg-surface-2 overflow-hidden">
                      <div
                        className="h-full bg-accent"
                        style={{ width: `${Math.max(share, 2)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>

            {data.estimatedMissingCostUsd > 0 && (
              <p className="text-xs text-muted-foreground mt-4 flex items-start gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  Aproximadamente {formatCost(data.estimatedMissingCostUsd)} de chamadas antigas
                  (anteriores a 14/10/2026) não registravam custo e foram estimados pela mesma
                  tabela de preços.
                </span>
              </p>
            )}

            <p className="text-xs text-muted-foreground mt-3">
              Valores estimados a partir de tabelas de preço de referência por modelo. Modelos
              locais (Ollama, LM Studio) não têm custo. Confira os valores antes de usar para
              faturamento.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`font-medium mt-0.5 ${highlight ? 'text-accent text-lg' : 'text-base'}`}>
        {value}
      </div>
    </div>
  );
}
