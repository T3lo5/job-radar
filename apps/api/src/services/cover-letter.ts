import type { AIMessage } from './ai/types.js';
import { createAiClient } from './ai/factory.js';
import { checkCvIntegrity, type IntegrityResult } from './cv-integrity.js';
import { sensitiveDataDetector } from './sensitive-data-detector.js';

export type CoverLetterLanguage = 'pt-BR' | 'en';

export interface CoverLetterRequest {
  jobTitle: string;
  company: string;
  jobDescription: string;
  profileContext: string;
  recruiterName?: string;
  /** Idioma da carta. Quando ausente, é detectado da vaga. */
  language?: CoverLetterLanguage;
  /** Fontes usadas na checagem de integridade (perfil + CV, por exemplo). */
  evidenceSources?: string[];
}

export interface CoverLetterResult {
  letter: string;
  language: CoverLetterLanguage;
  /**
   * Tecnologias que o modelo declarou ter atribuído ao candidato. É o que a
   * checagem de integridade confere contra o perfil/CV.
   */
  skillsClaimed: string[];
  tokensUsed?: number;
  /** A descrição passou do limite e só um trecho foi enviado ao modelo. */
  descriptionTruncated: boolean;
  descriptionChars: number;
  /** Avisos de integridade. `fabricatedSkills` vazio = aprovado. */
  integrity: IntegrityResult;
  warning?: string;
}

/**
 * Limite de descrição enviada ao modelo.
 *
 * Antes era 3.000 caracteres cortados em silêncio: uma vaga que pedia "Go"
 * depois do caractere 3.001 era simplesmente ignorada pelo modelo, e o usuário
 * não tinha como saber. Agora o limite é bem maior e, quando ainda assim a
 * descrição não cabe, a resposta diz que houve corte e a UI avisa.
 */
export const MAX_DESCRIPTION_CHARS = 12_000;

const PT_MARKERS = [
  ' de ',
  ' para ',
  ' com ',
  ' uma ',
  ' não ',
  ' você ',
  ' experiência ',
  ' empresa ',
  ' vaga ',
  ' desenvolvedor ',
  ' nossa ',
  ' trabalho ',
  ' requisitos ',
  ' conhecimento ',
  ' inglês ',
  ' português ',
  ' sobre ',
  ' como ',
];

const EN_MARKERS = [
  ' the ',
  ' and ',
  ' with ',
  ' you ',
  ' your ',
  ' our ',
  ' we ',
  ' experience ',
  ' team ',
  ' role ',
  ' requirements ',
  ' knowledge ',
  ' will ',
  ' this ',
  ' to ',
  ' of ',
  ' for ',
];

/**
 * Detecta o idioma da vaga por marcadores frequentes.
 *
 * É heurística de propósito: chamar a IA para classificar custaria uma segunda
 * requisição por carta. Acentos contam como sinal forte de português, porque
 * descrições em inglês praticamente não os usam.
 */
export function detectJobLanguage(title: string, description: string): CoverLetterLanguage {
  const text = ` ${title} ${description} `.toLowerCase();

  let pt = 0;
  let en = 0;
  for (const marker of PT_MARKERS) {
    pt += text.split(marker).length - 1;
  }
  for (const marker of EN_MARKERS) {
    en += text.split(marker).length - 1;
  }

  if (/[ãõçáéíóúâêô]/.test(text)) pt += 3;

  // Empate fica em português: o produto é usado por candidatos brasileiros e
  // uma descrição ambígua ("React Developer") não deve virar carta em inglês
  // sem o usuário pedir.
  return pt >= en ? 'pt-BR' : 'en';
}

const LANGUAGE_NAMES: Record<CoverLetterLanguage, string> = {
  'pt-BR': 'Brazilian Portuguese',
  en: 'English',
};

function buildSystemPrompt(language: CoverLetterLanguage): string {
  const languageName = LANGUAGE_NAMES[language];

  return `You are a professional cover letter writer for tech candidates.

Your job is to write a personalized cover letter that:
- Opens with a greeting to the recruiter (use "Dear Hiring Team" if no name is given)
- States the role being applied for and where the candidate found it
- Highlights 2-3 concrete achievements from the candidate's real experience that match the job
- Shows genuine interest in the company, not just the role
- Closes with a call to action
- Is concise (250-350 words)
- Uses ONLY information from the candidate's profile - never invents companies, skills, or achievements
- Translates the candidate's role to the job title being applied for when they differ
- Uses bullet points for achievements if it improves readability

Write the ENTIRE letter in ${languageName}. Keep real company names, job titles and technologies as they are.

Return ONLY valid JSON with this exact shape:
{"letter": "the cover letter text", "skillsClaimed": ["React", "TypeScript"]}

"skillsClaimed" must list every technology you attribute to the candidate in the letter. It is used to verify that you did not invent experience. Do not include soft skills.`;
}

/** Extrai JSON da resposta; se o modelo devolver texto puro, usa como carta. */
export function parseCoverLetterContent(content: string): {
  letter: string;
  skillsClaimed: string[];
} {
  const trimmed = content.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/, '')
    .trim();

  try {
    const parsed = JSON.parse(withoutFence) as { letter?: unknown; skillsClaimed?: unknown };
    if (typeof parsed.letter === 'string' && parsed.letter.trim() !== '') {
      return {
        letter: parsed.letter.trim(),
        skillsClaimed: Array.isArray(parsed.skillsClaimed)
          ? parsed.skillsClaimed.filter(
              (s): s is string => typeof s === 'string' && s.trim() !== '',
            )
          : [],
      };
    }
  } catch {
    // Modelo antigo devolvendo só o texto: segue, sem evidência declarada.
  }

  return { letter: trimmed, skillsClaimed: [] };
}

export class CoverLetterGenerator {
  async generate(request: CoverLetterRequest): Promise<CoverLetterResult> {
    const ai = await createAiClient();

    // Redige dados sensíveis ANTES de qualquer chamada de IA. O texto bruto
    // nunca sai do ambiente do usuário — apenas a versão redigida com
    // placeholders estáveis vai para o provedor.
    const redactedProfile = sensitiveDataDetector.redact(request.profileContext);
    const redactedEvidence = (request.evidenceSources ?? []).map(
      (s) => sensitiveDataDetector.redact(s).redactedText,
    );

    const language =
      request.language ?? detectJobLanguage(request.jobTitle, request.jobDescription);
    const descriptionTruncated = request.jobDescription.length > MAX_DESCRIPTION_CHARS;
    const description = descriptionTruncated
      ? `${request.jobDescription.slice(0, MAX_DESCRIPTION_CHARS)}\n[descrição truncada em ${MAX_DESCRIPTION_CHARS} caracteres]`
      : request.jobDescription;

    const userPrompt = `Write a cover letter for this job application:

JOB:
Title: ${request.jobTitle}
Company: ${request.company}
Description: ${description}

CANDIDATE PROFILE (SOURCE OF TRUTH - USE ONLY THIS DATA):
${redactedProfile.redactedText}

${request.recruiterName ? `Recruiter name: ${request.recruiterName}` : ''}

Write ONLY the JSON object described in the system prompt. No markdown fences.`;

    const messages: AIMessage[] = [
      { role: 'system', content: buildSystemPrompt(language) },
      { role: 'user', content: userPrompt },
    ];

    const response = await ai.chat(messages, {
      temperature: 0.4,
      maxTokens: 2000,
      type: 'COVER_LETTER',
      timeoutMs: 120_000,
      // `type` já vira `AiRun.type`; o idioma vai no metadata para a auditoria
      // conseguir responder "esta carta saiu no idioma da vaga?".
      metadata: { language },
    });

    if (!response.content || response.content.trim().length === 0) {
      throw new Error(
        `Modelo retornou resposta vazia (latencyMs=${response.latencyMs}). Verifique o provedor de IA configurado em Configuracoes > IA.`,
      );
    }

    const { letter, skillsClaimed } = parseCoverLetterContent(response.content);

    const integrity = checkCvIntegrity({
      skillsClaimed,
      sources: redactedEvidence.length > 0 ? redactedEvidence : [redactedProfile.redactedText],
    });

    let warning: string | undefined;
    if (integrity.fabricatedSkills.length > 0) {
      warning =
        `A carta menciona ${integrity.fabricatedSkills.join(', ')}, mas isso não consta ` +
        'no seu perfil nem no CV original. Revise (ou remova) antes de enviar — a ' +
        'carta não pode afirmar experiência que você não tem.';
    }

    return {
      letter,
      language,
      skillsClaimed,
      tokensUsed: response.usage?.totalTokens,
      descriptionTruncated,
      descriptionChars: request.jobDescription.length,
      integrity,
      warning,
    };
  }
}

export const coverLetterGenerator = new CoverLetterGenerator();
