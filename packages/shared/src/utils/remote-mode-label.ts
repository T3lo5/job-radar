import type { RemoteMode } from '../types/job-source.js';

export const REMOTE_MODE_LABELS: Record<RemoteMode, { label: string; emoji: string }> = {
  remote: { label: 'Remoto', emoji: '🏠' },
  hybrid: { label: 'Híbrido', emoji: '🔄' },
  on_site: { label: 'Presencial', emoji: '🏢' },
  unknown: { label: 'Não informado', emoji: '❓' },
};
