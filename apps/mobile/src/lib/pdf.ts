/**
 * Extrae el texto de un PDF (extracto de tarjeta) en el navegador con pdf.js,
 * reconstruyendo las líneas por coordenada vertical para que cada renglón del
 * resumen quede en una sola línea de texto.
 */
export async function extraerTextoPDF(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString()

  const data = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data }).promise

  let out = ''
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p)
    const content = await page.getTextContent()

    // Agrupar items por Y (con tolerancia de 2px) y ordenar por X
    const lines = new Map<number, { x: number; str: string }[]>()
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue
      const y = Math.round(item.transform[5] / 2) * 2
      if (!lines.has(y)) lines.set(y, [])
      lines.get(y)!.push({ x: item.transform[4], str: item.str })
    }

    const sorted = [...lines.entries()].sort((a, b) => b[0] - a[0])
    for (const [, parts] of sorted) {
      out += parts.sort((a, b) => a.x - b.x).map((s) => s.str).join(' ') + '\n'
    }
    out += '\n'
  }

  await doc.cleanup()
  return out
}
