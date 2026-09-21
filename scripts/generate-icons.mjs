// PWA 아이콘(PNG) 생성 스크립트.
// 이미지 라이브러리를 새로 설치하지 않기 위해 Node 내장 zlib만으로 PNG를 직접 인코딩한다.
// 실행: node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const BERRY = [219, 39, 119]
const VIOLET = [124, 58, 237]

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ]
}

/** 브랜드 컬러 그라데이션 위에 흰색 "C" 링을 얹은 아이콘을 그린다. */
function drawIcon(size, { maskable }) {
  const rgba = Buffer.alloc(size * size * 4)
  const cx = size / 2
  const cy = size / 2
  // maskable 아이콘은 바깥 10%가 잘릴 수 있어 글리프를 더 작게 그린다.
  const glyphScale = maskable ? 0.58 : 0.72
  const outer = (size / 2) * glyphScale
  const inner = outer * 0.62
  const radius = size * 0.22

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4
      // 배경: 좌상단 berry -> 우하단 violet
      const t = (x / size) * 0.5 + (y / size) * 0.5
      let [r, g, b] = mix(BERRY, VIOLET, t)
      let a = 255

      if (!maskable) {
        // 둥근 모서리(안티에일리어싱 없이 단순 마스크)
        const dx = Math.max(radius - x, x - (size - 1 - radius), 0)
        const dy = Math.max(radius - y, y - (size - 1 - radius), 0)
        if (dx > 0 && dy > 0 && Math.hypot(dx, dy) > radius) a = 0
      }

      const px = x + 0.5 - cx
      const py = y + 0.5 - cy
      const dist = Math.hypot(px, py)
      if (dist <= outer && dist >= inner) {
        // 오른쪽 방향(±42도)을 열어 "C" 모양을 만든다.
        const angle = Math.atan2(py, px)
        if (Math.abs(angle) > (42 * Math.PI) / 180) {
          r = 255
          g = 255
          b = 255
          a = 255
        }
      }

      rgba[i] = r
      rgba[i + 1] = g
      rgba[i + 2] = b
      rgba[i + 3] = a
    }
  }
  return encodePng(size, size, rgba)
}

mkdirSync(resolve(ROOT, 'public/icons'), { recursive: true })

const targets = [
  ['public/icons/icon-192.png', 192, { maskable: false }],
  ['public/icons/icon-512.png', 512, { maskable: false }],
  ['public/icons/icon-maskable-512.png', 512, { maskable: true }],
  ['public/icons/apple-touch-icon.png', 180, { maskable: true }],
]

for (const [file, size, options] of targets) {
  writeFileSync(resolve(ROOT, file), drawIcon(size, options))
  console.log(`generated ${file} (${size}x${size})`)
}
