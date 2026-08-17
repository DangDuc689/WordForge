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
): boolean {
  if (!submitted || !canonical) return false
  const s = normalizeAnswer(submitted)
  const sStripped = stripVietnameseDiacritics(s)

  // Tách chuỗi canonical theo dấu , hoặc ;
  const parts = canonical.split(/[,;]/).map((p) => p.trim()).filter(Boolean)

  for (const part of parts) {
    // Tạo biến thể gốc (có ngoặc) và biến thể bỏ ngoặc
    const variants = [
      part,
      part.replace(/\s*\([^)]*\)/g, '').trim(),
    ].filter(Boolean)

    for (const v of variants) {
      const c = normalizeAnswer(v)
      // Exact match (có dấu)
      if (s === c) return true
      // Match không dấu
      if (sStripped === stripVietnameseDiacritics(c)) return true
    }
  }

  return false
}

