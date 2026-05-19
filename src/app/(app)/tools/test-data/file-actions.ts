'use server'

import Anthropic from '@anthropic-ai/sdk'
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

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY_GENAI_Intellegence_PIPELINE!,
})

const SYSTEM_PROMPT = `You are a DLP testing file generator. Create realistic test files containing clearly-marked synthetic sensitive data for DLP control validation.

RESPONSE FORMAT — respond ONLY with valid JSON, no markdown, no text outside the JSON object:
{
  "filename": "suggested_filename.ext",
  "fileType": "text",
  "mimeType": "text/plain",
  "description": "Brief description of what was generated",
  "content": "...file content..."
}

For any .xlsx or Excel request, use fileType "xlsx" and a JSON array string for content:
{
  "filename": "data.xlsx",
  "fileType": "xlsx",
  "mimeType": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "description": "...",
  "content": "[{\\"col1\\":\\"val1\\",\\"col2\\":\\"val2\\"}]"
}
The content must be a valid JSON array string of row objects with consistent column keys.

RULES:
1. Always mark content as SYNTHETIC DLP TEST DATA via a comment, header, or prefix — never omit this
2. Generate realistic-looking synthetic data: fake PEM base64, SSNs as XXX-XX-XXXX, credit card numbers starting 4111 1111 1111, AWS keys starting AKIA, etc.
3. Handle any format the user requests: .pem, .key, .env, .yaml, .yml, .json, .sql, .csv, .log, .conf, .toml, .ini, .xml, .txt, .gitconfig, .npmrc, Dockerfile, Kubernetes YAML, .md, .htpasswd, .p8, and any other text-based format
4. For binary formats (.db, .p12, .docx, .pdf, .pkl, .pickle): generate best-effort text representation and note in description that it is a text approximation
5. Never generate real working credentials, actual cryptographic keys, or executable malicious code
6. For data files (JSON, SQL, CSV, logs): include at least 10–20 realistic records with PII, financial data, or health data as appropriate
7. For credential and config files: produce a complete, realistic structure — proper PEM headers, real-looking key structure, full .env/YAML layout
8. Choose the right mimeType: text/plain for .pem/.key/.env/log files, application/json for .json, application/sql for .sql, text/csv for .csv, application/x-yaml for .yaml`

const EMPTY: GeneratedFileResult = {
  filename: 'output.txt', fileType: 'text',
  mimeType: 'text/plain', description: '', content: '',
}

export async function generateFileWithAI(prompt: string): Promise<GeneratedFileResult> {
  try {
    const response = await anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 4096,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    if (!text) return { ...EMPTY, error: 'No response from AI. Please try again.' }

    const clean = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

    let parsed: GeneratedFileResult
    try {
      parsed = JSON.parse(clean)
    } catch {
      return { ...EMPTY, error: 'Unexpected response format from AI. Please try again.' }
    }

    const result: GeneratedFileResult = {
      filename:    typeof parsed.filename    === 'string' ? parsed.filename    : 'output.txt',
      fileType:    parsed.fileType === 'xlsx' ? 'xlsx' : 'text',
      mimeType:    typeof parsed.mimeType    === 'string' ? parsed.mimeType    : 'text/plain',
      description: typeof parsed.description === 'string' ? parsed.description : '',
      content:     typeof parsed.content     === 'string' ? parsed.content     : '',
    }

    // Log the AI search (fire-and-forget)
    logAiSearch('file_generator', prompt, `${result.filename} — ${result.description}`)

    // Auto-template: persist if ext is new and result is clean
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
