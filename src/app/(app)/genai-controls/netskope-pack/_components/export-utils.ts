// Download helpers for the Netskope recommendation export.
// Pattern copied from src/app/(app)/tools/test-data/_components/file-format-generator.tsx

export function dlBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  a.click()
  URL.revokeObjectURL(url)
}

export function dlText(content: string, filename: string, mime = 'text/plain') {
  dlBlob(new Blob([content], { type: mime }), filename)
}

/** YYYY-MM-DD — used in export filenames only. */
export function isoDate() {
  return new Date().toISOString().slice(0, 10)
}

/** ISO string → "YYYY-MM-DD HH:mm UTC" — used in PDF header. */
export function readableDate(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`
}
