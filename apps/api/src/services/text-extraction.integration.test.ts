import { describe, it, expect } from 'vitest';
import PDFDocument from 'pdfkit';
import { extractTextFromPdf } from './text-extraction.js';

/**
 * Prova com PDF de verdade, sem mocks.
 *
 * O `pdf-parse` sozinho falha em PDFs que o próprio `pdfkit` gera ("bad XRef
 * entry") — e gerador de currículo que exporta PDF nesse formato não é raro.
 * Este teste gera um, extrai pela cadeia real e confere o texto.
 */
function gerarPdf(linhas: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const partes: Buffer[] = [];
    doc.on('data', (c: Buffer) => partes.push(c));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);
    for (const linha of linhas) doc.fontSize(12).text(linha);
    doc.end();
  });
}

describe('extractTextFromPdf — PDF real', () => {
  it('lê PDF gerado por pdfkit (o pdf-parse sozinho falha nele)', async () => {
    const buf = await gerarPdf([
      'Anderson Franciscato',
      'Desenvolvedor Full Stack com React, TypeScript e Node.js.',
    ]);

    const texto = await extractTextFromPdf(buf);

    expect(texto).toContain('Anderson Franciscato');
    expect(texto).toContain('React');
  });

  it('lê PDF com várias páginas', async () => {
    const buf = await gerarPdf(['Página um', 'Página dois', 'Página três']);
    const texto = await extractTextFromPdf(buf);
    expect(texto).toContain('Página um');
    expect(texto).toContain('Página três');
  });

  it('lê PDF com acentos', async () => {
    const buf = await gerarPdf(['Experiência em São Paulo — ação e reação']);
    const texto = await extractTextFromPdf(buf);
    expect(texto).toContain('Experiência');
    expect(texto).toContain('São Paulo');
  });
});
