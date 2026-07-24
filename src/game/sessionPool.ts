import type { GameWord, SrsCard, VocabularyItem } from '../domain/types'
import { isDue } from '../lib/srs'
import { vocabularySenses } from '../domain/vocabulary'

export type GamePoolSource = 'due' | 'all'

export interface GamePoolOptions {
  source?: GamePoolSource
  selectedIds?: readonly string[]
}

export function buildGamePool(
  vocabulary: VocabularyItem[],
  cards: SrsCard[],
  deckId: string,
  now = new Date(),
  options: GamePoolOptions = {},
): GameWord[] {
  const cardMap = new Map(cards.map((card) => [card.vocabularyId, card]))
  const selected = options.selectedIds?.length ? new Set(options.selectedIds) : null
  return vocabulary
    .filter((word) => word.status === 'active' && (deckId === 'all' || word.deckId === deckId))
    .filter((word) => options.source !== 'due' || isDue(cardMap.get(word.id), now))
    .filter((word) => !selected || selected.has(word.id))
    .sort((a, b) => {
      const cardA = cardMap.get(a.id)
      const cardB = cardMap.get(b.id)
      const priority = (card: SrsCard | undefined) => !card ? 2 : isDue(card, now) ? 0 : (card.lapses > 0 || card.memoryLevel <= 2) ? 1 : 3
      return priority(cardA) - priority(cardB) || a.tier - b.tier
    })
    .slice(0, 60)
    .map((word) => {
      const card = cardMap.get(word.id)
      const senses = vocabularySenses(word)
      const sense = senses[0] ?? { vietnamese: word.vietnamese, partOfSpeech: word.partOfSpeech, tier: word.tier }
      return {
        id: word.id,
        english: word.english,
        vietnamese: sense.vietnamese,
        acceptedAnswers: word.acceptedAnswers,
        category: sense.partOfSpeech,
        tier: sense.tier,
        isDue: isDue(card, now),
      }
    })
}
