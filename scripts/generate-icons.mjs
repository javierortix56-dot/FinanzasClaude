/**
 * Generates minimal valid PNG icons for the PWA.
 * No external dependencies — uses only Node.js built-ins (zlib, fs).
 *
 * Produces:
 *   public/icon-192.png   (192x192, solid #10b981 + white $ sign)
 *   public/icon-512.png   (512x512, same design)
 *   public/icon-maskable.png (512x512, with safe-zone padding for maskable)
 */

import zlib from 'zlib'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC = path.join(__dirname, '..', 'public')

// ── PNG helpers ────────────────────────────────────────────────────────────────

function crc32(buf) {
  const table = (() => {
    const t = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      t[n] = c
    }
    return t
  })()
  let c = 0xffffffff
  for (const byte of buf) c = table[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([typeBytes, data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function buildPNG(rgba /* Buffer, width*4 per row, top-down */, width, height) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8  // bit depth
  ihdr[9] = 6  // color type: RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0

  // Raw image data with filter byte per row
  const rowSize = width * 4
  const raw = Buffer.alloc((1 + rowSize) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (1 + rowSize)] = 0  // filter: None
    rgba.copy(raw, y * (1 + rowSize) + 1, y * rowSize, (y + 1) * rowSize)
  }

  const compressed = zlib.deflateSync(raw, { level: 9 })

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ── Drawing helpers ────────────────────────────────────────────────────────────

function createCanvas(w, h) {
  const buf = Buffer.alloc(w * h * 4)  // RGBA
  const set = (x, y, r, g, b, a = 255) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return
    const i = (y * w + x) * 4
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = a
  }
  const fill = (r, g, b, a = 255) => { for (let i = 0; i < w * h * 4; i += 4) { buf[i] = r; buf[i+1] = g; buf[i+2] = b; buf[i+3] = a } }
  const rect = (x0, y0, x1, y1, r, g, b, a = 255) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) set(x, y, r, g, b, a)
  }
  // Bresenham circle fill
  const circle = (cx, cy, radius, r, g, b, a = 255) => {
    for (let y = -radius; y <= radius; y++)
      for (let x = -radius; x <= radius; x++)
        if (x * x + y * y <= radius * radius) set(cx + x, cy + y, r, g, b, a)
  }
  // Rounded rectangle
  const roundRect = (x0, y0, x1, y1, rad, r, g, b, a = 255) => {
    rect(x0 + rad, y0, x1 - rad, y1, r, g, b, a)
    rect(x0, y0 + rad, x1, y1 - rad, r, g, b, a)
    circle(x0 + rad, y0 + rad, rad, r, g, b, a)
    circle(x1 - rad, y0 + rad, rad, r, g, b, a)
    circle(x0 + rad, y1 - rad, rad, r, g, b, a)
    circle(x1 - rad, y1 - rad, rad, r, g, b, a)
  }
  // Thick horizontal bar
  const hbar = (x0, x1, y, thickness, r, g, b, a = 255) => {
    const half = Math.floor(thickness / 2)
    rect(x0, y - half, x1, y + half + 1, r, g, b, a)
  }
  // Thick vertical bar
  const vbar = (x, y0, y1, thickness, r, g, b, a = 255) => {
    const half = Math.floor(thickness / 2)
    rect(x - half, y0, x + half + 1, y1, r, g, b, a)
  }
  return { buf, fill, rect, circle, roundRect, hbar, vbar, w, h }
}

// ── Icon design ────────────────────────────────────────────────────────────────
// Green background (#10b981) + white "₿"-ish money chart bars

function drawIcon(size, padding = 0) {
  const c = createCanvas(size, size)

  // Background: #10b981 rounded rect
  const rad = Math.round(size * 0.22)
  const p = padding
  c.roundRect(p, p, size - p, size - p, rad, 16, 185, 129)

  // White bar chart (3 bars)
  const inner = size - p * 2
  const barW = Math.round(inner * 0.14)
  const thick = Math.max(1, Math.round(size * 0.005))
  const baseY = Math.round(p + inner * 0.78)
  const topY  = Math.round(p + inner * 0.20)

  // Bar positions (x center relative to icon)
  const bars = [
    { x: Math.round(p + inner * 0.22), h: Math.round(inner * 0.35) },
    { x: Math.round(p + inner * 0.50), h: Math.round(inner * 0.58) },
    { x: Math.round(p + inner * 0.78), h: Math.round(inner * 0.45) },
  ]

  // baseline
  c.hbar(Math.round(p + inner * 0.12), Math.round(p + inner * 0.88), baseY + barW / 2, Math.max(2, barW / 4), 255, 255, 255)

  for (const bar of bars) {
    c.roundRect(
      bar.x - Math.floor(barW / 2), baseY - bar.h,
      bar.x + Math.ceil(barW / 2),  baseY,
      Math.max(1, Math.floor(barW * 0.3)),
      255, 255, 255
    )
  }

  // Trend line over bars (broken into segments)
  const pts = bars.map(b => ({ x: b.x, y: baseY - b.h - Math.round(barW * 0.7) }))
  const lw = Math.max(2, Math.round(size * 0.025))
  for (let i = 0; i < pts.length - 1; i++) {
    const x0 = pts[i].x, y0 = pts[i].y, x1 = pts[i+1].x, y1 = pts[i+1].y
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))
    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      const lx = Math.round(x0 + t * (x1 - x0))
      const ly = Math.round(y0 + t * (y1 - y0))
      c.circle(lx, ly, Math.floor(lw / 2), 255, 255, 255)
    }
  }

  // Arrow head at last point
  const last = pts[pts.length - 1]
  const arrowSize = Math.round(size * 0.06)
  c.circle(last.x, last.y, Math.floor(lw / 2) + 1, 255, 255, 255)

  return buildPNG(c.buf, size, size)
}

// ── Generate ───────────────────────────────────────────────────────────────────

fs.mkdirSync(PUBLIC, { recursive: true })

fs.writeFileSync(path.join(PUBLIC, 'icon-192.png'), drawIcon(192))
console.log('✓ icon-192.png')

fs.writeFileSync(path.join(PUBLIC, 'icon-512.png'), drawIcon(512))
console.log('✓ icon-512.png')

// Maskable: safe zone is inner 80%, so add ~10% padding on each side
const maskPad = Math.round(512 * 0.10)
fs.writeFileSync(path.join(PUBLIC, 'icon-maskable.png'), drawIcon(512, maskPad))
console.log('✓ icon-maskable.png')

console.log('Icons generated in public/')
