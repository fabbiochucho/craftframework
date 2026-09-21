// Strips EXIF/GPS and embedded-editor metadata from uploaded images before they
// are stored. A photo taken on a phone commonly carries GPS coordinates, device
// serial numbers, and author/software tags in its metadata — for Data Room
// evidence (often photographed on-site at an institution) that's a real privacy
// leak if the raw file is ever shared or exported.
//
// Deliberately dependency-free: an image library like sharp needs a native
// binary bundled into the Netlify Function, which is extra deploy risk for a
// narrow need (only jpg/jpeg/png are in the upload allow-list). Both formats
// are simple enough to walk directly.
//
// Covers: JPEG (strips APP1/EXIF+XMP and APP13/Photoshop-IPTC segments) and PNG
// (strips tEXt/zTXt/iTXt/eXIf/tIME chunks). PDF/DOC/DOCX/XLS/XLSX/CSV — the rest
// of the upload allow-list — are passed through unchanged; stripping their
// metadata needs a format-specific library (pdf-lib for PDF, zip/XML surgery
// for Office formats) and is a separate, larger piece of work.
//
// Fails safe: any parsing error returns the original buffer rather than risk
// corrupting the file.

function stripJpeg(buf: Buffer): Buffer {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return buf
  const out: Buffer[] = [buf.subarray(0, 2)] // SOI
  let pos = 2
  const STRIP_MARKERS = new Set([0xe1, 0xed]) // APP1 (EXIF/XMP), APP13 (Photoshop/IPTC)

  while (pos + 4 <= buf.length) {
    if (buf[pos] !== 0xff) return buf // malformed — bail out unchanged
    const marker = buf[pos + 1]

    if (marker === 0xd9) {
      // EOI with nothing after — done.
      out.push(buf.subarray(pos, pos + 2))
      return Buffer.concat(out)
    }
    if (marker === 0xda) {
      // Start of Scan: everything from here to EOF is entropy-coded image data
      // (and the trailing EOI), never metadata. Copy the rest verbatim.
      out.push(buf.subarray(pos))
      return Buffer.concat(out)
    }

    const length = buf.readUInt16BE(pos + 2) // includes these 2 length bytes
    const segmentEnd = pos + 2 + length
    if (segmentEnd > buf.length) return buf // malformed — bail out unchanged

    if (!STRIP_MARKERS.has(marker)) {
      out.push(buf.subarray(pos, segmentEnd))
    }
    pos = segmentEnd
  }
  // Ran out of bytes before hitting SOS or EOI — truncated/malformed input.
  return buf
}

function stripPng(buf: Buffer): Buffer {
  const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIGNATURE)) return buf
  const STRIP_TYPES = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME'])

  const out: Buffer[] = [buf.subarray(0, 8)]
  let pos = 8
  while (pos + 8 <= buf.length) {
    const length = buf.readUInt32BE(pos)
    const type = buf.toString('ascii', pos + 4, pos + 8)
    const chunkEnd = pos + 12 + length // length + type(4) + data + crc(4)
    if (chunkEnd > buf.length) return buf // malformed — bail out unchanged

    if (!STRIP_TYPES.has(type)) {
      out.push(buf.subarray(pos, chunkEnd))
    }
    pos = chunkEnd
    if (type === 'IEND') return Buffer.concat(out)
  }
  // Ran out of bytes before hitting IEND — truncated/malformed input.
  return buf
}

export function stripImageMetadata(bytes: ArrayBuffer, contentType: string): ArrayBuffer {
  const buf = Buffer.from(bytes)
  try {
    if (contentType === 'image/jpeg' || contentType === 'image/jpg') {
      return toArrayBuffer(stripJpeg(buf))
    }
    if (contentType === 'image/png') {
      return toArrayBuffer(stripPng(buf))
    }
  } catch {
    return bytes
  }
  return bytes
}

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  const copy = new Uint8Array(buf.byteLength)
  copy.set(buf)
  return copy.buffer
}
