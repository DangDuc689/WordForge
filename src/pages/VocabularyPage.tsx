import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { PageHeader } from '../components/PageHeader'
import { OxfordImportModal } from '../components/OxfordImportModal'
import { VocabularyForm } from '../components/VocabularyForm'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  FolderIcon,
  GridIcon,
  ImportIcon,
  PlusIcon,
  RotateCcwIcon,
  SearchIcon,
  TableIcon,
  VolumeIcon,
} from '../components/Icons'
import { useApp } from '../context/AppContext'
import type { PartOfSpeech, VocabularyItem } from '../domain/types'
import { senseCefr, senseMeanings, senseParts, vocabularySenses } from '../domain/vocabulary'
import { useTts } from '../lib/tts'

export function VocabularyPage() {
  const { snapshot, archiveWord, deleteWord, saveDeck, deleteDeck } = useApp()
  const { speak: speakTts, isLoading: isTtsLoading } = useTts(snapshot.profile.ttsVoice)
  const [query, setQuery] = useState('')
  const [deckFilter, setDeckFilter] = useState(snapshot.decks[0]?.id ?? 'all')
  const [partFilter, setPartFilter] = useState<PartOfSpeech | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('active')
  const [progressFilter, setProgressFilter] = useState<'all' | 'new' | 'learned' | 'review'>('all')
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  const [flippedCardIds, setFlippedCardIds] = useState<Set<string>>(new Set())
  
  const [editing, setEditing] = useState<VocabularyItem | null | undefined>(undefined)
  const [deckName, setDeckName] = useState('')
  const [showDecks, setShowDecks] = useState(false)
  const [showOxford, setShowOxford] = useState(false)
  const [page, setPage] = useState(1)

  const searchInputRef = useRef<HTMLInputElement>(null)

  const cardsByWord = useMemo(() => new Map(snapshot.cards.map((card) => [card.vocabularyId, card])), [snapshot.cards])
  const filtered = useMemo(() => snapshot.vocabulary.filter((word) => {
    const needle = query.toLocaleLowerCase('vi')
    return (deckFilter === 'all' || word.deckId === deckFilter)
      && (partFilter === 'all' || senseParts(word).includes(partFilter))
      && (statusFilter === 'all' || word.status === statusFilter)
      && (progressFilter === 'all' || (progressFilter === 'new' ? !cardsByWord.has(word.id) : progressFilter === 'learned' ? cardsByWord.has(word.id) : Boolean(cardsByWord.get(word.id) && cardsByWord.get(word.id)!.reps > 0)))
      && (!needle || word.english.toLowerCase().includes(needle) || senseMeanings(word).some((meaning) => meaning.toLocaleLowerCase('vi').includes(needle)))
  }), [cardsByWord, deckFilter, partFilter, progressFilter, query, snapshot.vocabulary, statusFilter])
  
  const pageSize = 90
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const visibleWords = filtered.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => { setPage(1) }, [deckFilter, partFilter, progressFilter, query, statusFilter])
  useEffect(() => { if (page > pageCount) setPage(pageCount) }, [page, pageCount])

  // Keyboard shortcut handlers
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement
      const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')
      
      // Shortcut '/' focus search input
      if (e.key === '/' && !isInput) {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  const toggleCardFlip = (id: string) => {
    setFlippedCardIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const addDeck = async (event: FormEvent) => {
    event.preventDefault()
    if (!deckName.trim()) return
    const deck = await saveDeck(deckName.trim(), '')
    setDeckName('')
    setDeckFilter(deck.id)
  }

  const speak = (e: React.MouseEvent, word: string) => {
    e.stopPropagation() // Prevent flipping card on button click (Fitts's Law)
    void speakTts(word)
  }

  return (
    <div className="page vocabulary-page">
      <PageHeader
        eyebrow="Vocabulary vault"
        title={<>Kho <span className="accent">từ vựng</span></>}
        description={`${snapshot.vocabulary.filter((word) => word.status === 'active').length} mục từ đang hoạt động trong ${snapshot.decks.length} bộ từ.`}
        actions={
          <>
            <button className="button ghost" onClick={() => setShowOxford(true)}>
              <ImportIcon width="16" height="16" />
              <span>Nhập Oxford 3000</span>
            </button>
            <button className="button ghost" onClick={() => setShowDecks((value) => !value)}>
              <FolderIcon width="16" height="16" />
              <span>Quản lý bộ</span>
            </button>
            <button className="button primary" onClick={() => setEditing(null)}>
              <PlusIcon width="16" height="16" />
              <span>Thêm từ</span>
            </button>
          </>
        }
      />

      {showDecks && (
        <section className="panel deck-manager">
          <form onSubmit={addDeck}>
            <label>
              Tạo bộ từ mới
              <input value={deckName} onChange={(event) => setDeckName(event.target.value)} placeholder="Ví dụ: English for Work" />
            </label>
            <button className="button secondary">Tạo bộ từ</button>
          </form>
          <div className="deck-tag-list">
            {snapshot.decks.map((deck) => (
              <span key={deck.id} className="deck-tag">
                <b>{deck.name}</b>
                <small>{snapshot.vocabulary.filter((word) => word.deckId === deck.id).length} từ</small>
                <button
                  disabled={snapshot.decks.length <= 1}
                  className="icon-button mini"
                  onClick={() => window.confirm(`Xóa bộ “${deck.name}” và mọi từ bên trong?`) && void deleteDeck(deck.id)}
                  aria-label={`Xóa bộ ${deck.name}`}
                >
                  <CloseIcon width="12" height="12" />
                </button>
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="filter-bar panel">
        <label className="search-box">
          <span className="search-icon"><SearchIcon width="16" height="16" /></span>
          <input
            ref={searchInputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm tiếng Anh hoặc nghĩa Việt… (Bấm '/' để tìm)"
          />
        </label>
        
        <select value={deckFilter} onChange={(event) => setDeckFilter(event.target.value)}>
          <option value="all">Tất cả bộ từ</option>
          {snapshot.decks.map((deck) => <option key={deck.id} value={deck.id}>{deck.name}</option>)}
        </select>
        
        <select value={partFilter} onChange={(event) => setPartFilter(event.target.value as PartOfSpeech | 'all')}>
          <option value="all">Mọi loại từ</option>
          <option value="noun">Danh từ</option>
          <option value="verb">Động từ</option>
          <option value="adjective">Tính từ</option>
          <option value="adverb">Trạng từ</option>
          <option value="phrase">Cụm từ</option>
          <option value="pronoun">Đại từ</option>
          <option value="determiner">Từ hạn định</option>
          <option value="preposition">Giới từ</option>
          <option value="conjunction">Liên từ</option>
          <option value="interjection">Thán từ</option>
          <option value="numeral">Số từ</option>
          <option value="modal">Động từ khuyết thiếu</option>
          <option value="auxiliary">Trợ động từ</option>
          <option value="other">Khác</option>
        </select>
        
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
          <option value="active">Đang dùng</option>
          <option value="archived">Đã lưu trữ</option>
          <option value="all">Tất cả</option>
        </select>

        <select value={progressFilter} onChange={(event) => setProgressFilter(event.target.value as typeof progressFilter)}>
          <option value="all">Mọi tiến độ</option>
          <option value="new">Chưa học</option>
          <option value="learned">Đã học</option>
          <option value="review">Đang ôn</option>
        </select>

        <div className="view-mode-toggle" role="radiogroup" aria-label="Chế độ hiển thị">
          <button
            className={`toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
            onClick={() => setViewMode('table')}
            title="Dạng Bảng"
            aria-label="Dạng Bảng"
          >
            <TableIcon width="16" height="16" />
          </button>
          <button
            className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => setViewMode('grid')}
            title="Dạng Thẻ 3D"
            aria-label="Dạng Thẻ 3D"
          >
            <GridIcon width="16" height="16" />
          </button>
        </div>
      </section>

      {/* Main Content Area: Table vs 3D Flashcard Grid */}
      {viewMode === 'table' ? (
        <div className="vocab-table-wrap panel">
          <table className="vocab-table">
            <thead>
              <tr>
                <th>Từ / Cụm từ</th>
                <th>Nghĩa Việt</th>
                <th>Phân loại</th>
                <th>Tiến độ</th>
                <th className="text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {visibleWords.map((word) => {
                const card = cardsByWord.get(word.id)
                const state = !card ? 'Chưa học' : card.memoryLevel === 6 ? 'Nhớ sâu' : ('Cấp ' + card.memoryLevel)
                return (
                  <tr key={word.id} className={word.status === 'archived' ? 'archived' : ''}>
                    <td>
                      <div className="word-cell">
                        <button
                          className="speak-button icon-button mini"
                          onClick={(e) => speak(e, word.english)}
                          disabled={isTtsLoading(word.english)}
                          aria-busy={isTtsLoading(word.english)}
                          aria-label={`Phát âm ${word.english}`}
                          title="Phát âm"
                        >
                          <VolumeIcon width="14" height="14" />
                        </button>
                        <span>
                          <b>{word.english}</b>
                          <small>{[...new Set(vocabularySenses(word).map((sense) => sense.ipa).filter(Boolean))].join(' · ') || word.acceptedAnswers.join(' · ') || 'Chưa có IPA'}</small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <b>{senseMeanings(word).join(' · ')}</b>
                      <small>{word.exampleEn}{vocabularySenses(word).length > 1 ? ` · ${vocabularySenses(word).length} nghĩa` : ''}</small>
                    </td>
                    <td>
                      <span className={`tier tier-${word.tier}`}>T{word.tier}</span>
                      <small>{senseParts(word).join(' / ')} · {senseCefr(word).filter(Boolean).join(' / ') || '—'}</small>
                    </td>
                    <td>
                      <b>{state}</b>
                      <small>{card ? `Đã ôn ${card.reps} lần` : 'Chưa lên lịch'}</small>
                    </td>
                    <td className="text-right">
                      <button className="table-action" onClick={() => setEditing(word)}>Sửa</button>
                      <button className="table-action" onClick={() => void archiveWord(word)}>{word.status === 'active' ? 'Lưu trữ' : 'Khôi phục'}</button>
                      <button
                        className="table-action button-danger-text"
                        onClick={() => window.confirm(`Bạn có chắc muốn xóa từ "${word.english}" không?`) && void deleteWord(word.id)}
                      >
                        Xóa
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="empty-state">Không tìm thấy mục từ phù hợp.</div>}
        </div>
      ) : (
        /* 3D Flashcard Grid View with Tactile Card Interaction */
        <div className="vocab-grid-wrap">
          {visibleWords.map((word) => {
            const card = cardsByWord.get(word.id)
            const level = !card ? 0 : card.memoryLevel || 1
            const stateLabel = !card ? 'Chưa học' : card.memoryLevel === 6 ? 'Nhớ sâu' : (`Cấp ${card.memoryLevel}`)
            const isFlipped = flippedCardIds.has(word.id)

            return (
              <div key={word.id} className="flashcard-3d-card-unit">
                {/* 3D Flipping Card Container */}
                <div
                  className={`flashcard-3d-canvas ${isFlipped ? 'is-flipped' : ''}`}
                  onClick={() => toggleCardFlip(word.id)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault()
                      toggleCardFlip(word.id)
                    }
                  }}
                  role="button"
                  aria-label={`Thẻ 3D từ vựng ${word.english}, nhấn Space hoặc Click để lật`}
                >
                  <div className="flashcard-3d-inner">
                    {/* Front Face */}
                    <div className="flashcard-face flashcard-front">
                      <div className="card-face-top">
                        <span className={`tier tier-${word.tier}`}>T{word.tier}</span>
                        <span className={`card-state-badge level-${level}`}>{stateLabel}</span>
                      </div>
                      <div className="card-face-center">
                        <h3 className="card-word">{word.english}</h3>
                        <p className="card-ipa">
                          {[...new Set(vocabularySenses(word).map((s) => s.ipa).filter(Boolean))].join(' · ') || 'Chưa có IPA'}
                        </p>
                      </div>
                      <div className="card-face-bottom">
                        <button
                          type="button"
                          className="quick-audio-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            speak(e, word.english)
                          }}
                          disabled={isTtsLoading(word.english)}
                          aria-busy={isTtsLoading(word.english)}
                          title="Nghe phát âm"
                          aria-label={`Nghe phát âm ${word.english}`}
                        >
                          <VolumeIcon width="14" height="14" />
                        </button>
                        <span className="flip-hint">
                          <RotateCcwIcon width="12" height="12" /> Lật thẻ
                        </span>
                      </div>
                    </div>

                    {/* Back Face */}
                    <div className="flashcard-face flashcard-back">
                      <div className="card-face-top">
                        <span className="card-pos">{senseParts(word).join(' / ')}</span>
                        <span className="card-cefr">{senseCefr(word).filter(Boolean).join(' / ') || '—'}</span>
                      </div>
                      <div className="card-face-center">
                        <h4 className="card-meaning">{senseMeanings(word).join(' · ')}</h4>
                        {word.exampleEn && (
                          <p className="card-example">
                            "{word.exampleEn}"
                          </p>
                        )}
                      </div>
                      <div className="card-face-bottom">
                        <span className="flip-hint">
                          <RotateCcwIcon width="12" height="12" /> Mặt trước
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Safe Actions Strip Outside 3D Flip Area */}
                <div className="flashcard-actions-strip">
                  <button
                    className="action-strip-btn"
                    onClick={(e) => speak(e, word.english)}
                    disabled={isTtsLoading(word.english)}
                    aria-busy={isTtsLoading(word.english)}
                    title="Phát âm"
                    aria-label={`Phát âm ${word.english}`}
                  >
                    <VolumeIcon width="14" height="14" />
                    <span>Nghe</span>
                  </button>
                  <button className="action-strip-btn" onClick={() => setEditing(word)} title="Sửa từ vựng">
                    Sửa
                  </button>
                  <button className="action-strip-btn" onClick={() => void archiveWord(word)} title={word.status === 'active' ? 'Lưu trữ từ' : 'Khôi phục từ'}>
                    {word.status === 'active' ? 'Lưu trữ' : 'Khôi phục'}
                  </button>
                  <button
                    className="action-strip-btn danger-text"
                    onClick={() => window.confirm(`Bạn có chắc muốn xóa từ "${word.english}" không?`) && void deleteWord(word.id)}
                    title="Xóa từ"
                  >
                    Xóa
                  </button>
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && <div className="empty-state panel">Không tìm thấy mục từ phù hợp.</div>}
        </div>
      )}

      {/* Pagination Bar */}
      {filtered.length > 0 && (
        <div className="table-pagination panel">
          <span>Hiển thị {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} / {filtered.length} mục từ</span>
          <div className="pagination-controls">
            <button className="button ghost mini" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>
              <ChevronLeftIcon width="14" height="14" />
              <span>Trước</span>
            </button>
            <span className="page-number"><b>{page}</b> / {pageCount}</span>
            <button className="button ghost mini" disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>
              <span>Sau</span>
              <ChevronRightIcon width="14" height="14" />
            </button>
          </div>
        </div>
      )}

      {editing !== undefined && (
        <VocabularyForm
          word={editing}
          defaultDeckId={deckFilter === 'all' ? snapshot.decks[0]?.id ?? '' : deckFilter}
          onClose={() => setEditing(undefined)}
        />
      )}
      
      {showOxford && (
        <OxfordImportModal
          onClose={() => setShowOxford(false)}
          onImported={(deckIds) => {
            if (deckIds.length === 1) setDeckFilter(deckIds[0])
            setShowOxford(false)
          }}
        />
      )}
    </div>
  )
}
