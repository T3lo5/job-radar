import { createReadStream, mkdirSync, existsSync, writeFileSync, stat } from 'node:fs'
import { unlink } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { Readable } from 'node:stream'
import type { Stats } from 'node:fs'

const UPLOAD_DIR = join(process.cwd(), 'uploads')

if (!existsSync(UPLOAD_DIR)) {
  mkdirSync(UPLOAD_DIR, { recursive: true })
}

export interface StoredFile {
  filename: string
  originalName: string
  mimeType: string
  size: number
  path: string
}

export async function saveFile(
  data: Buffer,
  originalName: string,
  mimeType: string,
): Promise<StoredFile> {
  const ext = extname(originalName)
  const filename = `${randomUUID()}${ext}`
  const path = join(UPLOAD_DIR, filename)

  writeFileSync(path, data)

  const stats = await new Promise<Stats>((resolve, reject) => {
    stat(path, (err, stats) => {
      if (err) reject(err)
      else resolve(stats)
    })
  })

  return {
    filename,
    originalName,
    mimeType,
    size: stats.size,
    path,
  }
}

export async function deleteFile(filename: string): Promise<void> {
  const path = join(UPLOAD_DIR, filename)
  await unlink(path)
}

export function readFileStream(filename: string): Readable {
  const path = join(UPLOAD_DIR, filename)
  return createReadStream(path)
}
