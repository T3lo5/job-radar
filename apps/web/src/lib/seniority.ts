import { seniorityLabel, maxSeniority, type Seniority } from '@job-radar/shared';

interface PerfilSenioridade {
  seniority?: string | null;
  seniorityList?: string[] | null;
}

/**
 * O perfil tem DOIS campos de senioridade, e eles divergiram.
 *
 * - `seniority` (única): o wizard de setup grava aqui. O motor de matching usa
 *   aqui para o score.
 * - `seniorityList` (lista): a página de perfil edita aqui. O filtro de vagas
 *   usa aqui.
 *
 * Quem passava pelo setup e abria o perfil via os botões todos apagados e a
 * linha de exibição em branco — mesmo com a senioridade salva. As três funções
 * abaixo são a cola que mantém os dois campos concordando até alguém unificar
 * o schema.
 */

/**
 * O que os botões de senioridade devem mostrar como selecionado.
 *
 * Se a lista está vazia mas a única tem valor, a única vence: é o que o
 * sistema está usando para pontuar, e mostrar "nada selecionado" mentiria.
 */
export function initialSeniorityList(profile: PerfilSenioridade | null | undefined): string[] {
  const lista = profile?.seniorityList ?? [];
  if (lista.length > 0) return [...lista];
  if (profile?.seniority) return [profile.seniority];
  return [];
}

/**
 * O que a linha "Senioridade" mostra no modo leitura.
 *
 * O bug original: `[].join(', ')` é `''`, que não é nullish — então o `??`
 * nunca caía para `profile.seniority` e a linha ficava em branco. Além disso
 * mostrava o enum cru ('SENIOR') em vez do rótulo ('Sênior').
 */
export function displaySeniority(profile: PerfilSenioridade | null | undefined): string {
  const lista = profile?.seniorityList ?? [];
  if (lista.length > 0) {
    return lista.map((s) => seniorityLabel(s)).join(', ');
  }
  if (profile?.seniority) return seniorityLabel(profile.seniority);
  return '-';
}

/**
 * A senioridade única que acompanha a lista no salvamento.
 *
 * Sem isto, quem edita só a lista deixa a única defasada — e o score de
 * senioridade passa a usar um valor que o usuário não vê em lugar nenhum.
 * A regra é a maior da lista: se você aceita vagas Sênior, pontua como Sênior.
 */
export function syncedSeniority(
  lista: ReadonlyArray<string | null | undefined>,
  atual: string | null | undefined,
): Seniority | null | undefined {
  if (lista.length === 0) return atual as Seniority | null | undefined;
  return maxSeniority(lista);
}
