import { describe, it, expect, vi, beforeEach } from 'vitest';

// O módulo importa pdf-parse, mammoth e unpdf no topo. Para forçar cada
// caminho sem depender de arquivo real, os dois extratores de PDF são
// mockados; os testes com PDF de verdade estão em outro bloco.
vi.mock('pdf-parse', () => ({
  default: vi.fn(),
}));

vi.mock('unpdf', () => ({
  extractText: vi.fn(),
}));

import pdfParse from 'pdf-parse';
import { extractText as extractComUnpdf } from 'unpdf';
import { extractTextFromPdf, FALHA_PDF } from './text-extraction.js';

const pdfParseMock = pdfParse as unknown as ReturnType<typeof vi.fn>;
const unpdfMock = extractComUnpdf as unknown as ReturnType<typeof vi.fn>;

// Sem isto, as chamadas de um teste vazam para o `toHaveBeenCalled` do
// seguinte — e o teste quebra sem que o código tenha mudado.
beforeEach(() => {
  vi.clearAllMocks();
});

describe('extractTextFromPdf — reserva', () => {
  it('usa o unpdf primeiro e devolve o texto', async () => {
    unpdfMock.mockResolvedValueOnce({ text: 'texto do unpdf', totalPages: 1 });

    const texto = await extractTextFromPdf(Buffer.from('fake'));

    expect(texto).toBe('texto do unpdf');
    expect(pdfParseMock).not.toHaveBeenCalled();
  });

  it('cai para o pdf-parse quando o unpdf falha', async () => {
    // Este é o caminho que salvava o usuário: o unpdf estoura num PDF
    // estranho, mas o parser antigo lê.
    unpdfMock.mockRejectedValueOnce(new Error('Invalid number'));
    pdfParseMock.mockResolvedValueOnce({ text: 'texto do pdf-parse' });

    const texto = await extractTextFromPdf(Buffer.from('fake'));

    expect(texto).toBe('texto do pdf-parse');
  });

  it('junta as paginas quando o unpdf devolve array', async () => {
    // O `text` do unpdf vem como array (um por página) em alguns arquivos.
    // Assumir string quebrava com `text.trim is not a function` — e o catch
    // engolia em silêncio, jogando para a reserva um PDF que já tinha texto.
    unpdfMock.mockResolvedValueOnce({ text: ['Página um', 'Página dois'], totalPages: 2 });

    const texto = await extractTextFromPdf(Buffer.from('fake'));

    expect(texto).toContain('Página um');
    expect(texto).toContain('Página dois');
    expect(pdfParseMock).not.toHaveBeenCalled();
  });

  it('pula para a reserva quando o unpdf devolve vazio', async () => {
    // PDF de imagem: sem erro, mas sem texto. Tratar vazio como falha evita
    // gravar um currículo sem conteúdo em silêncio.
    unpdfMock.mockResolvedValueOnce({ text: '   \n  ', totalPages: 1 });
    pdfParseMock.mockResolvedValueOnce({ text: 'texto real' });

    expect(await extractTextFromPdf(Buffer.from('fake'))).toBe('texto real');
  });

  it('diz o que fazer quando nenhum dos dois lê', async () => {
    unpdfMock.mockRejectedValueOnce(new Error('Invalid number: (charCode 32)'));
    pdfParseMock.mockRejectedValueOnce(new Error('bad XRef entry'));

    await expect(extractTextFromPdf(Buffer.from('fake'))).rejects.toThrow(FALHA_PDF);
  });

  it('a mensagem de falha é acionável, não técnica', () => {
    expect(FALHA_PDF).toContain('DOCX');
    expect(FALHA_PDF).not.toContain('charCode');
    expect(FALHA_PDF).not.toContain('XRef');
  });
});
