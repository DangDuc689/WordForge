import type { AppSnapshot, CefrLevel, PartOfSpeech, SrsCard, VocabularyItem, VocabularySense } from './types'

export const normalizeHeadword = (value: string): string => value
  .normalize('NFKC')
  .trim()
  .replace(/\s+/g, ' ')
  .toLocaleLowerCase('en-US')

const senseIdentity = (sense: VocabularySense): string => sense.sourceKey || [
  sense.partOfSpeech,
  sense.vietnamese.trim().toLocaleLowerCase('vi'),
  sense.ipa.trim(),
].join('|')

export function vocabularySenses(word: VocabularyItem): VocabularySense[] {
  if (word.senses?.length) return word.senses
  return [{
    sourceKey: word.sourceKey,
    vietnamese: word.vietnamese,
    partOfSpeech: word.partOfSpeech,
    tier: word.tier,
    cefr: word.cefr,
    ipa: word.ipa,
    exampleEn: word.exampleEn,
    exampleVi: word.exampleVi,
    notes: word.notes,
  }]
}

export function withVocabularySenses(word: VocabularyItem, senses: VocabularySense[]): VocabularyItem {
  const unique = [...new Map(senses.map((sense) => [senseIdentity(sense), sense])).values()]
  const primary = unique[0] ?? vocabularySenses(word)[0]
  return {
    ...word,
    vietnamese: primary.vietnamese,
    partOfSpeech: primary.partOfSpeech,
    tier: primary.tier,
    cefr: primary.cefr,
    ipa: primary.ipa,
    exampleEn: primary.exampleEn,
    exampleVi: primary.exampleVi,
    notes: primary.notes,
    senses: unique,
  }
}

export function mergeVocabularyItems(keeper: VocabularyItem, duplicate: VocabularyItem): VocabularyItem {
  return withVocabularySenses({
    ...keeper,
    acceptedAnswers: [...new Set([...keeper.acceptedAnswers, ...duplicate.acceptedAnswers])],
    status: keeper.status === 'active' || duplicate.status === 'active' ? 'active' : 'archived',
    updatedAt: keeper.updatedAt > duplicate.updatedAt ? keeper.updatedAt : duplicate.updatedAt,
  }, [...vocabularySenses(keeper), ...vocabularySenses(duplicate)])
}

const cardStrength = (card: SrsCard | undefined): readonly number[] => card
  ? [card.memoryLevel, card.stability, card.lastReviewAt ? Date.parse(card.lastReviewAt) : 0]
  : [0, 0, 0]

const strongerCard = (left: SrsCard | undefined, right: SrsCard | undefined): SrsCard | undefined => {
  const a = cardStrength(left)
  const b = cardStrength(right)
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return a[index] > b[index] ? left : right
  }
  return left ?? right
}

export interface VocabularyDeduplication {
  snapshot: AppSnapshot
  idMap: Map<string, string>
  merged: number
}

export function deduplicateSnapshot(snapshot: AppSnapshot): VocabularyDeduplication {
  const cardsByWord = new Map(snapshot.cards.map((card) => [card.vocabularyId, card]))
  const groups = new Map<string, VocabularyItem[]>()
  for (const word of snapshot.vocabulary) {
    const key = `${word.deckId}|${normalizeHeadword(word.english)}`
    groups.set(key, [...(groups.get(key) ?? []), withVocabularySenses(word, vocabularySenses(word))])
  }

  const idMap = new Map<string, string>()
  const vocabulary: VocabularyItem[] = []
  for (const words of groups.values()) {
    const keeper = [...words].sort((left, right) => {
      const strongest = strongerCard(cardsByWord.get(left.id), cardsByWord.get(right.id))
      if (strongest?.vocabularyId === left.id) return -1
      if (strongest?.vocabularyId === right.id) return 1
      return left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)
    })[0]
    let mergedWord = keeper
    for (const word of words) {
      idMap.set(word.id, keeper.id)
      if (word.id !== keeper.id) mergedWord = mergeVocabularyItems(mergedWord, word)
    }
    vocabulary.push(mergedWord)
  }

  const cardGroups = new Map<string, SrsCard[]>()
  for (const card of snapshot.cards) {
    const vocabularyId = idMap.get(card.vocabularyId) ?? card.vocabularyId
    cardGroups.set(vocabularyId, [...(cardGroups.get(vocabularyId) ?? []), { ...card, vocabularyId }])
  }
  const cards = [...cardGroups.entries()].map(([vocabularyId, grouped]) => {
    const strongest = grouped.reduce<SrsCard | undefined>((best, card) => strongerCard(best, card), undefined)!
    return {
      ...strongest,
      vocabularyId,
      reps: grouped.reduce((sum, card) => sum + card.reps, 0),
      lapses: grouped.reduce((sum, card) => sum + card.lapses, 0),
    }
  })

  const remapIds = (ids: string[]) => [...new Set(ids.map((id) => idMap.get(id) ?? id))]
  return {
    snapshot: {
      ...snapshot,
      vocabulary,
      cards,
      reviews: snapshot.reviews.map((review) => ({ ...review, vocabularyId: idMap.get(review.vocabularyId) ?? review.vocabularyId })),
      practiceSessions: snapshot.practiceSessions.map((session) => ({
        ...session,
        targetVocabularyIds: remapIds(session.targetVocabularyIds),
        content: {
          ...session.content,
          glossary: session.content.glossary.map((item) => ({ ...item, vocabularyId: idMap.get(item.vocabularyId) ?? item.vocabularyId })),
          questions: session.content.questions.map((item) => ({ ...item, vocabularyId: item.vocabularyId ? (idMap.get(item.vocabularyId) ?? item.vocabularyId) : null })),
        },
      })),
    },
    idMap,
    merged: snapshot.vocabulary.length - vocabulary.length,
  }
}

export const senseParts = (word: VocabularyItem): PartOfSpeech[] => [...new Set(vocabularySenses(word).map((sense) => sense.partOfSpeech))]
export const senseMeanings = (word: VocabularyItem): string[] => vocabularySenses(word).map((sense) => sense.vietnamese)
export const senseCefr = (word: VocabularyItem): CefrLevel[] => [...new Set(vocabularySenses(word).map((sense) => sense.cefr))]
