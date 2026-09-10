export function normalizeAnswer(value: string | undefined | null): string {
  if (!value) return ''
  return value
    .normalize('NFC')
    .toLowerCase()
    .trim()
    .replace(/[.!?;,]+$/g, '')
    .replace(/\s+/g, ' ')
}

export function isAcceptedAnswer(
  submitted: string | undefined | null,
  canonical: string | undefined | null,
  acceptedAnswers: (string | undefined | null)[] = [],
): boolean {
  if (!submitted || !canonical) return false
  const normalizedSubmitted = normalizeAnswer(submitted)
  
  // So khớp với từ chuẩn (canonical)
  if (normalizeAnswer(canonical) === normalizedSubmitted) return true
  
  // So khớp với danh sách các câu trả lời chấp nhận khác
  if (Array.isArray(acceptedAnswers)) {
    return acceptedAnswers.some((answer) => answer && normalizeAnswer(answer) === normalizedSubmitted)
  }
  
  return false
}

export function normalizeVietnamese(value: string | undefined | null): string {
  if (!value) return ''
  return value.normalize('NFC').toLowerCase().trim().replace(/\s+/g, ' ')
}

// Bỏ tất cả dấu tiếng Việt: à→a, ă→a, â→a, đ→d, ê→e, ô→o, ơ→o, ư→u, v.v.
export function stripVietnameseDiacritics(value: string): string {
  if (!value) return ''
  return value
    .normalize('NFD')                   // Tách ký tự gốc và dấu combining
    .replace(/[\u0300-\u036f]/g, '')    // Xóa tất cả combining marks (dấu)
    .replace(/đ/g, 'd')                // đ không decompose được, xử lý riêng
    .replace(/Đ/g, 'D')
    .normalize('NFC')
}

// Match tiếng Việt: chấp nhận cả có dấu lẫn không dấu
export function isAcceptedVietnameseAnswer(
  submitted: string | undefined | null,
  canonical: string | undefined | null,
  acceptedAnswers: (string | undefined | null)[] = [],
): boolean {
  if (!submitted) return false
  const s = normalizeAnswer(submitted)
  if (!s) return false
  const sStripped = stripVietnameseDiacritics(s)

  const targets = [canonical, ...(Array.isArray(acceptedAnswers) ? acceptedAnswers : [])].filter(Boolean) as string[]
  if (targets.length === 0) return false

  // Gom các biến thể hợp lệ (cả có ngoặc, đã bỏ ngoặc và các phần tách phẩy)
  const candidates = new Set<string>()
  for (const target of targets) {
    const cleaned = target.replace(/\s*\([^)]*\)/g, '').trim()
    candidates.add(target)
    if (cleaned) candidates.add(cleaned)

    for (const text of [target, cleaned]) {
      for (const part of text.split(/[,;]/)) {
        const trimmed = part.trim()
        if (!trimmed) continue
        candidates.add(trimmed)
        const unparen = trimmed.replace(/\s*\([^)]*\)/g, '').trim()
        if (unparen) candidates.add(unparen)
      }
    }
  }

  for (const candidate of candidates) {
    const c = normalizeAnswer(candidate)
    if (!c) continue
    if (s === c || sStripped === stripVietnameseDiacritics(c)) return true
  }

  return false
}

