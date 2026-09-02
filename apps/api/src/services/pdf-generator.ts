import PDFDocument from 'pdfkit'

export function generatePdf(text: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 })
    const chunks: Buffer[] = []

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    // Title
    doc.fontSize(18).text('CV Optimized', { align: 'center' })
    doc.moveDown()

    // Content
    doc.fontSize(11)
    const lines = text.split('\n')
    for (const line of lines) {
      if (line.trim() === '') {
        doc.moveDown(0.5)
      } else if (line.startsWith('#')) {
        doc.moveDown(0.5).fontSize(14).text(line.replace(/^#+\s/, ''))
        doc.fontSize(11)
      } else {
        doc.text(line, { continued: false })
      }
    }

    doc.end()
  })
}
