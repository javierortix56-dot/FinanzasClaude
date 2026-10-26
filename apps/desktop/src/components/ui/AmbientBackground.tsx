/** Fondo ambiental: manchas de color difuminadas detrás de las superficies glass */
export default function AmbientBackground() {
  return (
    <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <div className="ambient-blob a w-[620px] h-[620px] -top-48 -left-40" style={{ background: 'var(--blob-1)' }} />
      <div className="ambient-blob b w-[560px] h-[560px] top-[20%] -right-48" style={{ background: 'var(--blob-2)' }} />
      <div className="ambient-blob c w-[520px] h-[520px] -bottom-48 left-[30%]" style={{ background: 'var(--blob-3)' }} />
    </div>
  )
}
