import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  CoverLetterGenerator,
  detectJobLanguage,
  parseCoverLetterContent,
  MAX_DESCRIPTION_CHARS,
} from './cover-letter.js';

const chat = vi.hoisted(() => vi.fn());

vi.mock('./ai/factory.js', () => ({
  createAiClient: async () => ({ chat }),
}));

beforeEach(() => {
  chat.mockReset();
});

function resposta(content: string) {
  return {
    content,
    latencyMs: 10,
    usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
  };
}

const PERFIL = `Skills:
- React (ADVANCED)
- TypeScript (ADVANCED)

Work Experience:
- Desenvolvedor na Google (2020-2024)`;

const VAGA_PT = `Estamos contratando uma pessoa desenvolvedora para atuar com React e TypeScript.
A vaga é para o nosso time de produto, com trabalho remoto e benefícios.`;

const VAGA_EN = `We are hiring a software engineer to work with React and TypeScript.
You will join our product team and work with the engineering team.`;

describe('detectJobLanguage', () => {
  it('detecta vaga em português', () => {
    expect(detectJobLanguage('Pessoa Desenvolvedora', VAGA_PT)).toBe('pt-BR');
  });

  it('detecta vaga em inglês', () => {
    expect(detectJobLanguage('Software Engineer', VAGA_EN)).toBe('en');
  });

  it('empate cai em português (produto brasileiro)', () => {
    expect(detectJobLanguage('React Developer', '')).toBe('pt-BR');
  });
});

describe('parseCoverLetterContent', () => {
  it('lê o JSON com carta e skills declaradas', () => {
    const r = parseCoverLetterContent(
      '{"letter":"Dear team,\\n...","skillsClaimed":["React","TypeScript"]}',
    );
    expect(r.letter).toContain('Dear team');
    expect(r.skillsClaimed).toEqual(['React', 'TypeScript']);
  });

  it('aceita JSON cercado de markdown', () => {
    const r = parseCoverLetterContent('```json\n{"letter":"Olá","skillsClaimed":[]}\n```');
    expect(r.letter).toBe('Olá');
  });

  it('cai para texto puro quando o modelo não devolve JSON', () => {
    const r = parseCoverLetterContent('Prezado time,\n\nTenho interesse na vaga.');
    expect(r.letter).toContain('Tenho interesse');
    expect(r.skillsClaimed).toEqual([]);
  });

  it('ignora skillsClaimed que não são strings', () => {
    const r = parseCoverLetterContent('{"letter":"x","skillsClaimed":["React",1,null]}');
    expect(r.skillsClaimed).toEqual(['React']);
  });
});

describe('CoverLetterGenerator', () => {
  it('usa o idioma detectado da vaga quando não há override', async () => {
    chat.mockResolvedValue(resposta('{"letter":"Carta","skillsClaimed":[]}'));

    const result = await new CoverLetterGenerator().generate({
      jobTitle: 'Pessoa Desenvolvedora',
      company: 'ACME',
      jobDescription: VAGA_PT,
      profileContext: PERFIL,
    });

    expect(result.language).toBe('pt-BR');
    const [messages, options] = chat.mock.calls[0] as [Array<{ content: string }>, any];
    expect(messages[0].content).toContain('Brazilian Portuguese');
    expect(options.metadata).toEqual({ language: 'pt-BR' });
  });

  it('respeita o override e o registra na execução', async () => {
    chat.mockResolvedValue(resposta('{"letter":"Letter","skillsClaimed":[]}'));

    const result = await new CoverLetterGenerator().generate({
      jobTitle: 'Pessoa Desenvolvedora',
      company: 'ACME',
      jobDescription: VAGA_PT,
      profileContext: PERFIL,
      language: 'en',
    });

    expect(result.language).toBe('en');
    const [messages, options] = chat.mock.calls[0] as [Array<{ content: string }>, any];
    expect(messages[0].content).toContain('Write the ENTIRE letter in English');
    expect(options.metadata).toEqual({ language: 'en' });
  });

  it('não corta descrição longa sem avisar', async () => {
    chat.mockResolvedValue(resposta('{"letter":"Carta","skillsClaimed":[]}'));
    const descricao = 'a'.repeat(10_000);

    const result = await new CoverLetterGenerator().generate({
      jobTitle: 'Dev',
      company: 'ACME',
      jobDescription: descricao,
      profileContext: PERFIL,
    });

    expect(result.descriptionTruncated).toBe(false);
    expect(result.descriptionChars).toBe(10_000);
    expect(chat.mock.calls[0][0][1].content).toContain(descricao);
  });

  it('informa quando a descrição passa do limite', async () => {
    chat.mockResolvedValue(resposta('{"letter":"Carta","skillsClaimed":[]}'));
    const descricao = 'a'.repeat(MAX_DESCRIPTION_CHARS + 500);

    const result = await new CoverLetterGenerator().generate({
      jobTitle: 'Dev',
      company: 'ACME',
      jobDescription: descricao,
      profileContext: PERFIL,
    });

    expect(result.descriptionTruncated).toBe(true);
    expect(result.descriptionChars).toBe(MAX_DESCRIPTION_CHARS + 500);
    expect(chat.mock.calls[0][0][1].content).toContain('[descrição truncada');
  });

  it('avisa quando a carta atribui skill sem evidência', async () => {
    chat.mockResolvedValue(
      resposta('{"letter":"Tenho experiência com Go.","skillsClaimed":["Go"]}'),
    );

    const result = await new CoverLetterGenerator().generate({
      jobTitle: 'Dev',
      company: 'ACME',
      jobDescription: VAGA_PT,
      profileContext: PERFIL,
      evidenceSources: [PERFIL],
    });

    // "Go" não pode casar com "Google" por substring.
    expect(result.integrity.fabricatedSkills).toEqual(['Go']);
    expect(result.warning).toContain('Go');
  });

  it('não avisa quando a skill declarada existe no perfil', async () => {
    chat.mockResolvedValue(resposta('{"letter":"Trabalhei com React.","skillsClaimed":["React"]}'));

    const result = await new CoverLetterGenerator().generate({
      jobTitle: 'Dev',
      company: 'ACME',
      jobDescription: VAGA_PT,
      profileContext: PERFIL,
      evidenceSources: [PERFIL],
    });

    expect(result.integrity.fabricatedSkills).toEqual([]);
    expect(result.warning).toBeUndefined();
  });

  it('mensagem de recrutador entra no prompt', async () => {
    chat.mockResolvedValue(resposta('{"letter":"Carta","skillsClaimed":[]}'));

    await new CoverLetterGenerator().generate({
      jobTitle: 'Dev',
      company: 'ACME',
      jobDescription: VAGA_PT,
      profileContext: PERFIL,
      recruiterName: 'Maria Silva',
    });

    expect(chat.mock.calls[0][0][1].content).toContain('Recruiter name: Maria Silva');
  });
});
