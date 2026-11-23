/**
 * Detecção de achievements (métricas) em bullets de experiência.
 *
 * Baseado no guia: "Cada bullet deve ter ação + ferramenta + resultado".
 * Um achievement é um bullet que contém um número ou porcentagem que
 * representa um resultado mensurável.
 */

export interface Achievement {
  text: string;
  metric?: string;
}

/**
 * Verifica se um bullet contém uma métrica mensurável.
 * Exemplos: "reduziu em 30%", "aumentou de 5h para 30min", "95% de satisfação"
 */
export function detectAchievement(text: string): Achievement | null {
  const metrics = text.match(
    /(\d+(?:[.,]\d+)?)\s*(%|hours?|hrs?|min(?:ute)?s?|seg(?:undo)?s?|d(?:ia)?s?|mil(?:hares?)?|k\b|M\b|unidades?|usuários?| clientes?| chamadas?| chamada)/gi,
  );
  if (!metrics) return null;

  const pct = text.match(/(\d+(?:[.,]\d+)?)\s*%/);
  const timeBefore = text.match(/(\d+(?:[.,]\d+)?)\s*(?:hours?|hrs?|h)\b/i);
  const timeAfter = text.match(/(?:para|to|→|->)\s*(\d+(?:[.,]\d+)?)\s*(?:hours?|hrs?|h)/i);

  let metric: string | undefined;
  if (pct) metric = `${pct[1]}%`;
  else if (timeBefore && timeAfter) metric = `${timeBefore[1]}h → ${timeAfter[1]}h`;
  else if (timeBefore) metric = `${timeBefore[1]}h`;

  return { text, metric };
}

/**
 * Separa uma lista de bullets (separados por newline ou por marcadores comuns)
 * e retorna apenas os que são achievements.
 */
export function extractAchievements(bullets: string[]): Achievement[] {
  return bullets
    .map((b) => b.replace(/^[\s•\-\*\u2022\u25AA\u25E6]+/, '').trim())
    .filter(Boolean)
    .map(detectAchievement)
    .filter((a): a is Achievement => a !== null);
}
