export const MATCH_LABEL_COLORS = {
  excellent: {
    bg: 'bg-success/10',
    text: 'text-success',
    border: 'border-success',
    icon: 'CheckCircle',
  },
  good: {
    bg: 'bg-accent/10',
    text: 'text-accent',
    border: 'border-accent',
    icon: 'CheckCircle',
  },
  fair: {
    bg: 'bg-warning/10',
    text: 'text-warning',
    border: 'border-warning',
    icon: 'AlertCircle',
  },
  poor: {
    bg: 'bg-error/10',
    text: 'text-error',
    border: 'border-error',
    icon: 'AlertCircle',
  },
} as const

export const CHART_COLORS = [
  'hsl(0 84% 60%)',
  'hsl(33 95% 50%)',
  'hsl(48 96% 55%)',
  'hsl(160 60% 55%)',
  'hsl(43 96% 55%)',
]

export const SENIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  INTERN: { bg: 'bg-surface-2', text: 'text-muted-foreground' },
  JUNIOR: { bg: 'bg-surface-2', text: 'text-muted-foreground' },
  MID: { bg: 'bg-accent/10', text: 'text-accent' },
  SENIOR: { bg: 'bg-success/10', text: 'text-success' },
  SPECIALIST: { bg: 'bg-warning/10', text: 'text-warning' },
  LEAD: { bg: 'bg-error/10', text: 'text-error' },
  UNKNOWN: { bg: 'bg-surface-2', text: 'text-muted-foreground' },
}

export const SOURCE_STATUS_COLORS = {
  RAW: { bg: 'bg-surface-2', text: 'text-muted-foreground' },
  EXTRACTING: { bg: 'bg-accent/10', text: 'text-accent' },
  MATCHING: { bg: 'bg-accent/10', text: 'text-accent' },
  ANALYZING: { bg: 'bg-accent/10', text: 'text-accent' },
  DONE: { bg: 'bg-success/10', text: 'text-success' },
  FAILED: { bg: 'bg-error/10', text: 'text-error' },
} as const
