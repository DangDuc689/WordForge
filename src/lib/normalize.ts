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

