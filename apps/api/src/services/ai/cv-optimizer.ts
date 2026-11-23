import type { AIClient, AIMessage } from './types.js';

/**
 * Extrai o primeiro objeto JSON válido de um texto.
 *
 * Alguns modelos de raciocínio (ex: SenseNova, DeepSeek R1) devolvem o
 * resultado no campo `reasoning`, que contém o raciocínio livre seguido da
 * resposta final. Fazer `JSON.parse` direto nisso falha. Esta função localiza
 * o primeiro `{` e o último `}` e parseia só esse trecho.
 */
function extractJson(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    return text;
  }
  return text.slice(start, end + 1);
}

export interface CvOptimization {
  optimizedText: string;
  changes: Array<{
    type: 'reorder' | 'rewrite' | 'keyword_add' | 'summary';
    section: string;
    description: string;
  }>;
  keywordsAdded: string[];
  summary: string;
  /**
   * Tecnologias que o modelo afirma ter usado no CV otimizado.
   *
   * É o que permite verificar a Regra de Ouro de forma programática: cada item
   * precisa existir no perfil ou no CV original. Sem este campo, a única defesa
   * contra invenção seria o próprio pedido no prompt.
   */
  skillsClaimed?: string[];
}

export class CvOptimizer {
  private readonly ai: AIClient;

  constructor(ai: AIClient) {
    this.ai = ai;
  }

  async optimize(
    cvText: string,
    jobTitle: string,
    jobDescription: string,
    matchedSkills: string[],
    missingSkills: string[],
  ): Promise<CvOptimization> {
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `You are a CV optimizer. Given a candidate's CV and a job description, suggest optimizations to better match the job requirements.

Return ONLY valid JSON. Do NOT write any explanation, markdown, or text outside the JSON. Your entire response must start with an opening brace and end with a closing brace.
The JSON must have this exact shape:
  optimizedText: "The full optimized CV text",
  changes: [ { "type": "reorder|rewrite|keyword_add|summary", "section": "section name", "description": "what was changed" } ],
  keywordsAdded: ["keyword1", "keyword2"],
  summary: "Professional summary tailored to the job"

CRITICAL RULES:
- NEVER invent information not present in the original CV
- ONLY reorganize, rephrase, or rewrite existing information
- Keywords added must be from the original CV, just repositioned
- If a skill is not in the CV, do NOT add it
- Maintain the candidate's original experience and achievements

FORMATTING RULES:
- PRESERVE the original CV's structure and section headings. Do NOT rename, remove, or add top-level sections.
- Do NOT add a title banner like "CV Optimized" or "Optimized Resume" at the top. Start directly with the candidate's name and contact info, exactly as in the original CV.
- Keep the same bullet style, spacing, and line structure. Only reorder bullets within a section if it helps match the job.`,
      },
      {
        role: 'user',
        content: `Job: ${jobTitle}

Job Description: ${jobDescription.slice(0, 3000)}

Matched Skills: ${matchedSkills.join(', ')}

Missing Skills: ${missingSkills.join(', ')}

Original CV:
${cvText.slice(0, 6000)}`,
      },
    ];

    const response = await this.ai.chat(messages, {
      temperature: 0.2,
      // O prompt é grande (CV inteiro + perfil + descrição) e a resposta é um
      // JSON também grande. 4000 tokens é insuficiente quando o CV é extenso —
      // o modelo corta a resposta no meio e o JSON.parse falha, ou volta vazio
      // quando o limite é menor que o necessário para começar a gerar.
      maxTokens: 8000,
      type: 'CV_OPTIMIZE',
      // 15s padrão do cliente é insuficiente para modelos mais lentos — dava
      // "The operation was aborted due to timeout".
      timeoutMs: 120_000,
    });

    if (!response.content || response.content.trim().length === 0) {
      throw new Error(
        `Modelo retornou resposta vazia (latencyMs=${response.latencyMs}). Verifique o provedor de IA configurado em Configurações > IA.`,
      );
    }

    try {
      return JSON.parse(extractJson(response.content)) as CvOptimization;
    } catch {
      throw new Error(
        `Failed to parse CV optimization: ${extractJson(response.content).slice(0, 200)}`,
      );
    }
  }

  async optimizeWithProfile(
    cvText: string,
    jobTitle: string,
    jobDescription: string,
    profileContext: string,
  ): Promise<CvOptimization> {
    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `You are a CV optimizer for ATS (Applicant Tracking Systems). Your job is to optimize a candidate's CV for a specific job opening.

You will receive:
1. The candidate's PROFILE (source of truth) - contains ONLY real information about the candidate
2. The candidate's CURRENT CV text
3. The JOB DESCRIPTION they are applying for

CRITICAL RULES - YOU MUST FOLLOW THESE:
1. NEVER invent, fabricate, or hallucinate any information
2. ONLY use data from the candidate's profile or current CV
3. If a skill/experience is not in the profile/CV, do NOT add it
4. If a date is missing, leave it blank or use "Present" for current roles
5. Do NOT add fake companies, fake degrees, or fake certifications
6. Do NOT claim experience with tools/technologies not explicitly mentioned in the profile or CV
7. If the job requires something the candidate doesn't have, focus on highlighting what they DO have that's relevant
8. Keep all contact information, dates, and factual data exactly as provided
9. Reorganize sections to prioritize relevant experience
10. Use keywords from the job description ONLY if they match the candidate's actual skills/experience
11. "skillsClaimed" must list EVERY technology you attribute to the candidate in "optimizedText". Never list anything the profile or CV does not support - the answer is verified against the source data before it reaches the user.

FORMATTING RULES - YOU MUST FOLLOW THESE:
12. PRESERVE THE ORIGINAL CV'S STRUCTURE AND SECTION HEADINGS. Do NOT rename, remove, or add top-level sections (e.g. keep "EXPERIENCE", "EDUCATION", "SKILLS" as-is).
13. Do NOT add a title banner like "CV Optimized", "Optimized Resume", or any header at the top. Start directly with the candidate's name and contact info, exactly as in the original CV.
14. Keep the same bullet style, spacing, and line structure. Only reorder bullets within a section if it helps match the job; never merge paragraphs or split them.
15. If the original CV has no clear section structure, infer minimal sections from the content but do NOT invent a cover header.

Return ONLY valid JSON. Do NOT write any explanation, markdown, or text outside the JSON. Your entire response must start with an opening brace and end with a closing brace.
The JSON must have this exact shape:
  optimizedText: "The full optimized CV text",
  changes: [ { "type": "reorder|rewrite|keyword_add|summary", "section": "section name", "description": "what was changed and why" } ],
  keywordsAdded: ["keyword1", "keyword2"],
  skillsClaimed: ["every technology you attribute to the candidate in optimizedText"],
  summary: "Professional summary tailored to the job using ONLY real candidate data"`,
      },
      {
        role: 'user',
        content: `CANDIDATE PROFILE (SOURCE OF TRUTH - USE ONLY THIS DATA):
${profileContext}

CURRENT CV TEXT:
${cvText.slice(0, 6000)}

JOB DESCRIPTION:
${jobTitle ? `Job Title: ${jobTitle}\n\n` : ''}${jobDescription.slice(0, 4000)}`,
      },
    ];

    const response = await this.ai.chat(messages, {
      temperature: 0.2,
      // O prompt é grande (CV inteiro + perfil + descrição) e a resposta é um
      // JSON também grande. 4000 tokens é insuficiente quando o CV é extenso —
      // o modelo corta a resposta no meio e o JSON.parse falha, ou volta vazio
      // quando o limite é menor que o necessário para começar a gerar.
      maxTokens: 8000,
      type: 'CV_OPTIMIZE',
      // 15s padrão do cliente é insuficiente para modelos mais lentos — dava
      // "The operation was aborted due to timeout".
      timeoutMs: 120_000,
    });

    if (!response.content || response.content.trim().length === 0) {
      throw new Error(
        `Modelo retornou resposta vazia (latencyMs=${response.latencyMs}). Verifique o provedor de IA configurado em Configurações > IA.`,
      );
    }

    try {
      return JSON.parse(extractJson(response.content)) as CvOptimization;
    } catch {
      throw new Error(
        `Failed to parse CV optimization: ${extractJson(response.content).slice(0, 200)}`,
      );
    }
  }
}
