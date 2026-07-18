import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { PageHeader } from '../components/PageHeader'
import { OxfordImportModal } from '../components/OxfordImportModal'
import { VocabularyForm } from '../components/VocabularyForm'
import { useApp } from '../context/AppContext'
import type { PartOfSpeech, VocabularyItem } from '../domain/types'

export function VocabularyPage() {
  const { snapshot, archiveWord, deleteWord, saveDeck, deleteDeck } = useApp()
  const [query, setQuery] = useState('')
  const [deckFilter, setDeckFilter] = useState(snapshot.decks[0]?.id ?? 'all')
  const [partFilter, setPartFilter] = useState<PartOfSpeech | 'all'>('all')
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('active')
  const [progressFilter, setProgressFilter] = useState<'all' | 'new' | 'learned' | 'review'>('all')
  const [editing, setEditing] = useState<VocabularyItem | null | undefined>(undefined)
  const [deckName, setDeckName] = useState('')
  const [showDecks, setShowDecks] = useState(false)
  const [showOxford, setShowOxford] = useState(false)
  const [page, setPage] = useState(1)
  const cardsByWord = useMemo(() => new Map(snapshot.cards.map((card) => [card.vocabularyId, card])), [snapshot.cards])
  const filtered = useMemo(() => snapshot.vocabulary.filter((word) => {
    const needle = query.toLocaleLowerCase('vi')
    return (deckFilter === 'all' || word.deckId === deckFilter)
      && (partFilter === 'all' || word.partOfSpeech === partFilter)
      && (statusFilter === 'all' || word.status === statusFilter)
      && (progressFilter === 'all' || (progressFilter === 'new' ? !cardsByWord.has(word.id) : progressFilter === 'learned' ? cardsByWord.has(word.id) : Boolean(cardsByWord.get(word.id) && cardsByWord.get(word.id)!.reps > 0)))
      && (!needle || word.english.toLowerCase().includes(needle) || word.vietnamese.toLocaleLowerCase('vi').includes(needle))
  }), [cardsByWord, deckFilter, partFilter, progressFilter, query, snapshot.vocabulary, statusFilter])
  const pageSize = 100
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const visibleWords = filtered.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => { setPage(1) }, [deckFilter, partFilter, progressFilter, query, statusFilter])
  useEffect(() => { if (page > pageCount) setPage(pageCount) }, [page, pageCount])

  const addDeck = async (event: FormEvent) => {
    event.preventDefault()
    if (!deckName.trim()) return
    const deck = await saveDeck(deckName.trim(), '')
    setDeckName('')
    setDeckFilter(deck.id)
  }

  const speak = (word: string) => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(word)
    utterance.lang = 'en-US'; utterance.rate = 0.85
    window.speechSynthesis.speak(utterance)
  }

  return (
    <div className="page vocabulary-page">
      <PageHeader eyebrow="Vocabulary vault" title={<>Kho <span className="accent">từ vựng</span></>} description={`${snapshot.vocabulary.filter((word) => word.status === 'active').length} mục đang hoạt động trong ${snapshot.decks.length} bộ từ.`} actions={<><button className="button ghost" onClick={() => setShowOxford(true)}>Nhập Oxford 3000</button><button className="button ghost" onClick={() => setShowDecks((value) => !value)}>Quản lý bộ</button><button className="button primary" onClick={() => setEditing(null)}>+ Thêm từ</button></>} />

      {showDecks && <section className="panel deck-manager">
        <form onSubmit={addDeck}><label>Tạo bộ từ mới<input value={deckName} onChange={(event) => setDeckName(event.target.value)} placeholder="Ví dụ: English for work" /></label><button className="button secondary">Tạo bộ</button></form>
        <div>{snapshot.decks.map((deck) => <span key={deck.id}><b>{deck.name}</b><small>{snapshot.vocabulary.filter((word) => word.deckId === deck.id).length} từ</small><button disabled={snapshot.decks.length <= 1} onClick={() => window.confirm(`Xóa bộ “${deck.name}” và mọi từ bên trong?`) && void deleteDeck(deck.id)}>×</button></span>)}</div>
      </section>}

      <section className="filter-bar panel">
        <label className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm tiếng Anh hoặc nghĩa Việt…" /></label>
        <select value={deckFilter} onChange={(event) => setDeckFilter(event.target.value)}><option value="all">Tất cả bộ từ</option>{snapshot.decks.map((deck) => <option key={deck.id} value={deck.id}>{deck.name}</option>)}</select>
        <select value={partFilter} onChange={(event) => setPartFilter(event.target.value as PartOfSpeech | 'all')}><option value="all">Mọi loại từ</option><option value="noun">Danh từ</option><option value="verb">Động từ</option><option value="adjective">Tính từ</option><option value="adverb">Trạng từ</option><option value="phrase">Cụm từ</option><option value="pronoun">Đại từ</option><option value="determiner">Từ hạn định</option><option value="preposition">Giới từ</option><option value="conjunction">Liên từ</option><option value="interjection">Thán từ</option><option value="numeral">Số từ</option><option value="modal">Động từ khuyết thiếu</option><option value="auxiliary">Trợ động từ</option><option value="other">Khác</option></select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}><option value="active">Đang dùng</option><option value="archived">Đã lưu trữ</option><option value="all">Tất cả</option></select><select value={progressFilter} onChange={(event) => setProgressFilter(event.target.value as typeof progressFilter)}><option value="all">Mọi tiến độ</option><option value="new">Chưa học</option><option value="learned">Đã học</option><option value="review">Đang ôn</option></select>
      </section>

      <div className="vocab-table-wrap panel">
        <table className="vocab-table"><thead><tr><th>Từ / cụm từ</th><th>Nghĩa</th><th>Phân loại</th><th>Tiến độ</th><th /></tr></thead><tbody>
          {visibleWords.map((word) => {
            const card = cardsByWord.get(word.id)
            const state = !card ? 'Mới · chưa học' : card.memoryLevel === 6 ? 'Nhớ sâu' : ('Cấp độ ' + card.memoryLevel)
            return <tr key={word.id} className={word.status === 'archived' ? 'archived' : ''}>
              <td><button className="speak-button" onClick={() => speak(word.english)} aria-label={`Phát âm ${word.english}`}>◖</button><span><b>{word.english}</b><small>{word.ipa || word.acceptedAnswers.join(' · ') || 'Chưa có IPA'}</small></span></td>
              <td><b>{word.vietnamese}</b><small>{word.exampleEn}</small></td>
              <td><span className={`tier tier-${word.tier}`}>T{word.tier}</span><small>{word.partOfSpeech} · {word.cefr || '—'}</small></td>
              <td><b>{state}</b><small>{card ? `Đã ôn ${card.reps} lần` : 'Chưa lên lịch'}</small></td>
              <td><button className="table-action" onClick={() => setEditing(word)}>Sửa</button><button className="table-action" onClick={() => void archiveWord(word)}>{word.status === 'active' ? 'Lưu trữ' : 'Khôi phục'}</button><button className="table-action" style={{ color: '#ef4444' }} onClick={() => window.confirm(`Bạn có chắc muốn xóa từ "${word.english}" không?`) && void deleteWord(word.id)}>Xóa</button></td>
            </tr>
          })}
        </tbody></table>
        {filtered.length === 0 && <div className="empty-state">Không tìm thấy mục từ phù hợp.</div>}
        {filtered.length > 0 && <div className="table-pagination"><span>Hiển thị {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} / {filtered.length}</span><div><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>← Trước</button><b>{page} / {pageCount}</b><button disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>Sau →</button></div></div>}
      </div>
      {editing !== undefined && <VocabularyForm word={editing} defaultDeckId={deckFilter === 'all' ? snapshot.decks[0].id : deckFilter} onClose={() => setEditing(undefined)} />}
      {showOxford && <OxfordImportModal onClose={() => setShowOxford(false)} onImported={(deckIds) => { if (deckIds.length === 1) setDeckFilter(deckIds[0]); setShowOxford(false) }} />}
    </div>
  )
}

