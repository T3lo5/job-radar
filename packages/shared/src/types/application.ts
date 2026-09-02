export const APPLICATION_STATUSES = [
  'encontrada',
  'interessante',
  'cv_preparado',
  'aplicada',
  'entrevista',
  'rejeitada',
  'oferta',
  'arquivada',
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
