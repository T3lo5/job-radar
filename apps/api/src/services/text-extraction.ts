import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { extractText as extractComUnpdf } from 'unpdf';

/**
 * Extração de texto com reserva.
 *
 * O `pdf-parse` (pdf.js de 2016) falha em PDFs perfeitamente válidos que usam
 * referências cruzadas modernas — inclusive nos que o próprio `pdfkit`
 * (dependência deste projeto) gera: "bad XRef entry". O erro que o usuário
 * via era técnico e inútil ("Invalid number: (charCode 32)").
 *
 * A ordem é deliberada: `unpdf` primeiro porque lê os PDFs atuais, `pdf-parse`
 * depois como reserva para os arquivos que só ele lia. O que muda para quem
 * já subia PDF sem erro é nada — o primeiro extrator continua devolvendo o
 * mesmo texto.
 */
/**
 * Normaliza o retorno do unpdf.
 *
 * O `text` vem como string ou como array (um por página), dependendo da
 * versão e do arquivo. Assumir string quebrava com `text.trim is not a
 * function` — erro que o `catch` engolia em silêncio e jogava para a reserva.
 */
function normalizarTextoUnpdf(text: unknown): string {
  if (typeof text === 'string') return text;
  if (Array.isArray(text)) return text.map((p) => String(p ?? '')).join('\n');
  return '';
}

async function extrairPdf(buffer: Buffer): Promise<string> {
  const bytes = new Uint8Array(buffer);

  try {
    const { text } = await extractComUnpdf(bytes);
    const normalizado = normalizarTextoUnpdf(text);
    if (normalizado.trim()) return normalizado;
  } catch {
    // Cai para a reserva abaixo.
  }

  try {
    const { text } = await pdfParse(buffer);
    if (text?.trim()) return text;
  } catch {
    // A mensagem útil sai no final, cobrindo os dois.
  }

  throw new Error(FALHA_PDF);
}

/**
 * Mensagem que o usuário recebe quando nenhum extrator lê o arquivo.
 *
 * Em português e com saída: dizer "Invalid number (charCode 32)" para quem
 * não é terminal é o mesmo que não dizer nada.
 */
export const FALHA_PDF =
  'Não consegui ler o texto desse PDF. Tente exportá-lo de novo ' +
  '(no editor: Imprimir → Salvar como PDF) ou envie o currículo em DOCX. ' +
  'Se o PDF for uma foto ou digitalização, o texto precisa ser extraído antes ' +
  '(OCR) — desse formato não há como ler.';

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  return extrairPdf(buffer);
}

export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

export async function extractText(buffer: Buffer, mimeType: string): Promise<string> {
  if (mimeType === 'application/pdf') {
    return extractTextFromPdf(buffer);
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword'
  ) {
    return extractTextFromDocx(buffer);
  }

  throw new Error(`Unsupported file type: ${mimeType}`);
}
