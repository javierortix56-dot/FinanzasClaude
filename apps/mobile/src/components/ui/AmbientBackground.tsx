/** Fondo ambiental: manchas de color difuminadas detrás de las superficies glass */
export default function AmbientBackground() {
  return (
    <div aria-hidden className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      <div className="ambient-blob a w-[340px] h-[340px] -top-24 -left-24" style={{ background: 'var(--blob-1)' }} />
      <div className="ambient-blob b w-[300px] h-[300px] top-[30%] -right-32" style={{ background: 'var(--blob-2)' }} />
      <div className="ambient-blob c w-[280px] h-[280px] -bottom-24 left-[10%]" style={{ background: 'var(--blob-3)' }} />
    </div>
  )
}
