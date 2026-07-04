/**
 * OCR de tickets en el dispositivo con tesseract.js (español).
 * La foto nunca sale del teléfono; los archivos del motor y el idioma se
 * descargan una sola vez desde el CDN de tesseract y quedan cacheados.
 */
export async function ocrImagen(
  file: File,
  onProgress?: (pct: number) => void
): Promise<string> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('spa', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress(Math.round(m.progress * 100))
      }
    },
  })
  try {
    const { data } = await worker.recognize(file)
    return data.text
  } finally {
    await worker.terminate()
  }
}
