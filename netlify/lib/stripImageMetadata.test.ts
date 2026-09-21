// Self-check for stripImageMetadata — run directly with `node netlify/lib/stripImageMetadata.test.ts`
// (Node 22.6+ strips TS types natively; no build step or test runner needed).
import assert from 'node:assert/strict'
// NB: imports the .ts extension directly (not the project's usual .js-referring-
// to-.ts convention) so this standalone script runs under plain `node` without
// a bundler — this file is a dev-time check only, never bundled into a function.
import { stripImageMetadata } from './stripImageMetadata.ts'

// The real call site (data-room-upload.mts) hands stripImageMetadata a Fetch
// API ArrayBuffer from req.arrayBuffer(), not a Node Buffer — convert test
// fixtures the same way so the signature under test matches production.
function toAB(buf: Buffer): ArrayBuffer {
  const copy = new Uint8Array(buf.byteLength)
  copy.set(buf)
  return copy.buffer
}

function jpegWithApp1(): Buffer {
  const app1Payload = Buffer.from('Exif\0\0fake-gps-and-camera-data')
  const app1 = Buffer.concat([
    Buffer.from([0xff, 0xe1]),
    (() => { const l = Buffer.alloc(2); l.writeUInt16BE(app1Payload.length + 2); return l })(),
    app1Payload,
  ])
  const sos = Buffer.from([0xff, 0xda, 0x00, 0x02])
  const scanData = Buffer.from([0x01, 0x02, 0xff, 0x00, 0x03]) // includes a stuffed 0xFF00
  const eoi = Buffer.from([0xff, 0xd9])
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app1, sos, scanData, eoi])
}

function pngWithTextChunk(): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  function chunk(type: string, data: Buffer): Buffer {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const typeBuf = Buffer.from(type, 'ascii')
    const crc = Buffer.alloc(4) // CRC correctness doesn't matter for this test
    return Buffer.concat([len, typeBuf, data, crc])
  }
  const ihdr = chunk('IHDR', Buffer.alloc(13))
  const text = chunk('tEXt', Buffer.from('Author\0Someone Identifiable'))
  const idat = chunk('IDAT', Buffer.from([1, 2, 3]))
  const iend = chunk('IEND', Buffer.alloc(0))
  return Buffer.concat([sig, ihdr, text, idat, iend])
}

// JPEG: APP1/EXIF is removed, image data (SOS onward) survives untouched.
{
  const input = jpegWithApp1()
  const out = Buffer.from(stripImageMetadata(toAB(input), 'image/jpeg'))
  assert.ok(!out.includes('fake-gps-and-camera-data'), 'EXIF payload should be stripped')
  assert.ok(out.includes(Buffer.from([0xff, 0xda])), 'SOS marker should survive')
  assert.equal(out.subarray(out.length - 2).toString('hex'), 'ffd9', 'EOI should survive')
}

// PNG: tEXt chunk is removed, IHDR/IDAT/IEND survive.
{
  const input = pngWithTextChunk()
  const out = Buffer.from(stripImageMetadata(toAB(input), 'image/png'))
  assert.ok(!out.includes('Someone Identifiable'), 'tEXt payload should be stripped')
  assert.ok(out.includes('IHDR'), 'IHDR should survive')
  assert.ok(out.includes('IDAT'), 'IDAT should survive')
  assert.ok(out.includes('IEND'), 'IEND should survive')
}

// Non-image types and malformed input pass through unchanged (fail-safe).
{
  const arbitrary = Buffer.from('not an image')
  const out = Buffer.from(stripImageMetadata(toAB(arbitrary), 'application/pdf'))
  assert.ok(out.equals(arbitrary), 'non-image content types must pass through untouched')

  const truncatedJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00]) // claims a length it doesn't have
  const outMalformed = Buffer.from(stripImageMetadata(toAB(truncatedJpeg), 'image/jpeg'))
  assert.ok(outMalformed.equals(truncatedJpeg), 'malformed JPEG must be returned unchanged, not corrupted')
}

console.log('stripImageMetadata: all checks passed')
