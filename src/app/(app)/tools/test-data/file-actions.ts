'use server'

import { callAgent } from '@/lib/api-client'
import { logAiSearch, saveLearnedTemplate } from '@/lib/ai-log'

const KNOWN_EXTS = new Set([
  '.pem','.key','.env','.yaml','.yml','.conf','.json','.sql','.log','.csv','.xlsx','.txt',
])

export interface GeneratedFileResult {
  filename:    string
  fileType:    'text' | 'xlsx'
  mimeType:    string
  description: string
  content:     string
  error?:      string
}

const EMPTY: GeneratedFileResult = {
  filename: 'output.txt', fileType: 'text',
  mimeType: 'text/plain', description: '', content: '',
}

export async function generateFileWithAI(prompt: string): Promise<GeneratedFileResult> {
  try {
    const result = await callAgent<GeneratedFileResult>('test-file', { prompt })

    logAiSearch('file_generator', prompt, `${result.filename} — ${result.description}`)

    const dotIdx = result.filename.lastIndexOf('.')
    const ext = dotIdx >= 0 ? result.filename.slice(dotIdx).toLowerCase() : ''
    const highConfidence =
      ext.length >= 2 && ext.length <= 7 &&
      result.content.length > 50 &&
      result.fileType !== 'xlsx'
    if (highConfidence && !KNOWN_EXTS.has(ext)) {
      saveLearnedTemplate({
        ext,
        filename:    result.filename,
        description: result.description || `AI-generated ${ext} file`,
        content:     result.content,
        mimeType:    result.mimeType,
      })
    }

    return result
  } catch (err) {
    return { ...EMPTY, error: err instanceof Error ? err.message : String(err) }
  }
}
