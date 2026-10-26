// Evaluador de expresiones para el campo de monto ("1500+320", "3*1200",
// "(100+50)/2"). Parser descendente propio: nunca usa eval. La coma es el
// separador decimal (como en el resto de los inputs de la app).

/** Devuelve el resultado, o null si la expresión está incompleta o es inválida */
export function evalExpr(input: string): number | null {
  const src = input.replace(/\s+/g, '').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/,/g, '.')
  if (!src) return null
  let i = 0

  function number(): number | null {
    const m = /^\d+\.?\d*|^\.\d+/.exec(src.slice(i))
    if (!m) return null
    i += m[0].length
    const n = parseFloat(m[0])
    return Number.isFinite(n) ? n : null
  }

  function factor(): number | null {
    if (src[i] === '-') { i++; const f = factor(); return f === null ? null : -f }
    if (src[i] === '+') { i++; return factor() }
    if (src[i] === '(') {
      i++
      const v = expr()
      if (v === null || src[i] !== ')') return null
      i++
      return v
    }
    return number()
  }

  function term(): number | null {
    let v = factor()
    while (v !== null && (src[i] === '*' || src[i] === '/')) {
      const op = src[i++]
      const r = factor()
      if (r === null) return null
      if (op === '/' && r === 0) return null
      v = op === '*' ? v * r : v / r
    }
    return v
  }

  function expr(): number | null {
    let v = term()
    while (v !== null && (src[i] === '+' || src[i] === '-')) {
      const op = src[i++]
      const r = term()
      if (r === null) return null
      v = op === '+' ? v + r : v - r
    }
    return v
  }

  const result = expr()
  if (result === null || i !== src.length || !Number.isFinite(result)) return null
  return Math.round(result * 100) / 100
}

/** true si el texto tiene alguna operación (no es solo un número) */
export function isExpression(input: string): boolean {
  return /\d\s*[+\-*/×÷−]\s*[\d(]/.test(input.replace(/,/g, '.'))
}
