export function normalizeAnswer(value: string): string {
  return value
    .toLocaleLowerCase('en')
    .trim()
    .replace(/[.!?;,]+$/g, '')
    .replace(/\s+/g, ' ')
}

export function isAcceptedAnswer(
  submitted: string,
  canonical: string,
  acceptedAnswers: string[] = [],
): boolean {
  const normalized = normalizeAnswer(submitted)
  return [canonical, ...acceptedAnswers].some((answer) => normalizeAnswer(answer) === normalized)
}

export function normalizeVietnamese(value: string): string {
  return value.toLocaleLowerCase('vi').trim().replace(/\s+/g, ' ')
}
