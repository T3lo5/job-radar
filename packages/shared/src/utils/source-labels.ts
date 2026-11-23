/**
 * Nomes legíveis de fontes de vaga, indexados por `sourceId`.
 *
 * A resposta da API para `Job` traz apenas `sourceId`; este mapa converte
 * o id técnico em um nome legível para o usuário. Nunca exibir o `sourceId`
 * cru na UI.
 */
export const SOURCE_NAMES: Record<string, string> = {
  linkedin: 'LinkedIn',
  indeed: 'Indeed',
  gupy: 'Gupy',
  catho: 'Catho',
  vagas: 'Vagas.com.br',
  infojobs: 'InfoJobs',
  trampos: 'Trampos.co',
  glassdoor: 'Glassdoor',
  muse: 'The Muse',
  wellfound: 'Wellfound (AngelList)',
  remoteok: 'Remote OK',
  weworkremotely: 'We Work Remotely',
  hackernews: 'Hacker News (Who is Hiring)',
  dribbble: 'Dribbble',
  github: 'GitHub Jobs',
  stackoverflow: 'Stack Overflow Jobs',
};

/** Retorna o nome legível da fonte ou o próprio id se desconhecido. */
export function sourceName(sourceId: string | null | undefined): string {
  if (!sourceId) return 'Não informado';
  return SOURCE_NAMES[sourceId] ?? sourceId;
}
