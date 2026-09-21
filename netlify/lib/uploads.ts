// Shared constants between presigned-url.mts (reserves an upload) and
// data-room-upload.mts (accepts the bytes), so the two enforce the same rules.
export const ALLOWED_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'png', 'jpg', 'jpeg'])
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024 // 25 MB
export const UPLOAD_WINDOW_SECONDS = 600 // how long a reserved key accepts an upload

export function extensionOf(fileName: string): string {
  return fileName.toLowerCase().split('.').pop() ?? ''
}
