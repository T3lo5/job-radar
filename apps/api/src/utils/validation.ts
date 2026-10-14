import { z } from 'zod';

/**
 * Escopos que a UI pode escrever.
 *
 * `POST /api/settings` aceitava scope/key arbitrários: qualquer cliente podia
 * criar qualquer setting em qualquer escopo (inclusive um escopo que o código
 * depois passaria a ler). A lista é fechada de propósito.
 */
export const WRITABLE_SCOPES = ['ai', 'telegram', 'cron', 'sources', 'apify', 'adzuna'] as const;

export const scopeSchema = z.enum(WRITABLE_SCOPES);

/**
 * URL restrita a http/https.
 *
 * `z.string().url()` aceitava `javascript:` (XSS por clique), `file:` e o range
 * de metadata `169.254.169.254` — que, usado como `baseUrl` do provedor de IA,
 * transformava a API em proxy para serviços internos. Verificado por execução:
 * todos passavam na validação anterior.
 *
 * A checagem de protocolo resolve `javascript:`/`file:`. O range link-local
 * (169.254.0.0/16) é bloqueado à parte porque é uma URL http legítima — lá vive
 * o endpoint de metadata de nuvem (AWS/GCP/Azure), o alvo clássico de SSRF.
 *
 * Faixas privadas (127.0.0.0/8, 10/8, 192.168/16…) seguem permitidas de
 * propósito: é o caso de um provedor auto-hospedado, como Ollama em outra
 * máquina da rede. Bloqueá-las quebraria um uso legítimo.
 *
 * O limite de tamanho entra antes do `refine` porque `refine` devolve um
 * `ZodEffects`, que não expõe `.max()`.
 */
export function httpUrl(maxLength?: number) {
  const base = maxLength ? z.string().url().max(maxLength) : z.string().url();
  return base
    .refine((value) => {
      try {
        const protocol = new URL(value).protocol;
        return protocol === 'http:' || protocol === 'https:';
      } catch {
        return false;
      }
    }, 'URL deve começar com http:// ou https://')
    .refine((value) => {
      const host = new URL(value).hostname;
      if (host === 'localhost' || host.endsWith('.localhost')) return true;
      // 169.254.0.0/16 — link-local, onde ficam os endpoints de metadata
      if (/^169\.254\./.test(host)) return false;
      // equivalente IPv6 (fe80::/10)
      if (/^fe80:/i.test(host)) return false;
      return true;
    }, 'URL aponta para um endereço link-local não permitido');
}

/**
 * Data opcional que aceita string vazia como "sem data".
 *
 * Todo `<Input type="date">` vazio manda `''`, e `z.coerce.date()` transforma
 * `''` em Data Inválida — o PUT respondia 400 e a edição "não salvava".
 * Atingia justo os registros importados do CV (sem datas): abrir a edição e
 * salvar, sem tocar em nada, já falhava.
 *
 * `''` vira `undefined` (campo intocado no PUT), e não `null`: com `null`, um
 * cliente que simplesmente omitisse a data apagaria a data gravada sem querer.
 * `null` explícito continua significando "limpar".
 */
export const dataOpcional = z.preprocess(
  (v) => (v === '' ? undefined : v),
  z.coerce.date().nullable().optional(),
);
