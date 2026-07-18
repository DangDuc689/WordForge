import { useEffect, useState, type FormEvent } from 'react'
import type { AiVocabularyDraft, CefrLevel, PartOfSpeech, VocabularyItem } from '../domain/types'
import { useApp } from '../context/AppContext'
import { enrichVocabulary } from '../lib/ai'

interface Props {
  word: VocabularyItem | null
  defaultDeckId: string
  onClose: () => void
}

const blankDraft: AiVocabularyDraft = {
  english: '', vietnamese: '', acceptedAnswers: [], partOfSpeech: 'noun', tier: 1, cefr: '',
  ipa: '', exampleEn: '', exampleVi: '', notes: '',
}

export function VocabularyForm({ word, defaultDeckId, onClose }: Props) {
  const { snapshot, saveWord } = useApp()
  const [deckId, setDeckId] = useState(word?.deckId ?? defaultDeckId)
  const [draft, setDraft] = useState<AiVocabularyDraft>(word ? {
    english: word.english, vietnamese: word.vietnamese, acceptedAnswers: word.acceptedAnswers,
    partOfSpeech: word.partOfSpeech, tier: word.tier, cefr: word.cefr, ipa: word.ipa,
    exampleEn: word.exampleEn, exampleVi: word.exampleVi, notes: word.notes,
  } : blankDraft)
  const [aliases, setAliases] = useState(draft.acceptedAnswers.join(', '))
  const [busy, setBusy] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => { document.body.classList.add('modal-open'); return () => document.body.classList.remove('modal-open') }, [])

  const update = <K extends keyof AiVocabularyDraft>(key: K, value: AiVocabularyDraft[K]) => setDraft((current) => ({ ...current, [key]: value }))

  const askAi = async () => {
    if (!draft.english.trim()) { setMessage('Hãy nhập từ tiếng Anh trước.'); return }
    if (!snapshot.profile.aiEnabled) { setMessage('Hãy bật AI trong Cài đặt trước.'); return }
    setAiBusy(true); setMessage('')
    try {
      const result = await enrichVocabulary(draft.english.trim(), deckId)
      setDraft(result)
      setAliases(result.acceptedAnswers.join(', '))
      setMessage('AI đã tạo bản nháp. Hãy kiểm tra kỹ trước khi lưu.')
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Không thể gọi AI.')
    } finally { setAiBusy(false) }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true); setMessage('')
    try {
      let finalDraft = { ...draft }
      
      if (!draft.exampleEn.trim() && snapshot.profile.aiEnabled) {
        setMessage('Đang nhờ AI tạo ví dụ tự động...')
        try {
          const result = await enrichVocabulary(draft.english.trim(), deckId)
          finalDraft.exampleEn = result.exampleEn
          finalDraft.exampleVi = result.exampleVi
          if (!finalDraft.ipa) finalDraft.ipa = result.ipa
        } catch (e) {
          console.warn('Auto AI generation failed', e)
        }
      }

      await saveWord({
        ...finalDraft,
        id: word?.id,
        deckId,
        english: finalDraft.english.trim(),
        vietnamese: finalDraft.vietnamese.trim(),
        acceptedAnswers: aliases.split(',').map((value) => value.trim()).filter(Boolean),
        status: word?.status ?? 'active',
      })
      onClose()
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'Không thể lưu từ.')
    } finally { setBusy(false) }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="word-form-title">
        <div className="modal-head"><span><small>{word ? 'Chỉnh sửa mục từ' : 'Thêm vào kho từ'}</small><h2 id="word-form-title">{word ? word.english : 'Từ vựng mới'}</h2></span><button className="icon-button" onClick={onClose} aria-label="Đóng">×</button></div>
        <form onSubmit={submit} className="word-form">
          <div className="form-grid two">
            <label>Tiếng Anh<input required autoFocus value={draft.english} onChange={(event) => update('english', event.target.value)} placeholder="opportunity" /></label>
            <label>Nghĩa tiếng Việt<input required value={draft.vietnamese} onChange={(event) => update('vietnamese', event.target.value)} placeholder="cơ hội" /></label>
          </div>
          <div className="ai-strip">
            <span><b>◇ AI enrichment</b><small>Dùng các từ bạn đã biết để tạo ví dụ dễ hiểu.</small></span>
            <button type="button" className="button secondary" disabled={aiBusy || !snapshot.profile.aiEnabled} onClick={() => void askAi()}>{aiBusy ? 'Đang tạo…' : 'Hoàn thiện bằng AI'}</button>
          </div>
          <label>Đáp án khác được chấp nhận<input value={aliases} onChange={(event) => setAliases(event.target.value)} placeholder="Ngăn cách bằng dấu phẩy" /></label>
          <div className="form-grid four">
            <label>Bộ từ<select value={deckId} onChange={(event) => setDeckId(event.target.value)}>{snapshot.decks.map((deck) => <option key={deck.id} value={deck.id}>{deck.name}</option>)}</select></label>
            <label>Loại từ<select value={draft.partOfSpeech} onChange={(event) => update('partOfSpeech', event.target.value as PartOfSpeech)}><option value="noun">Danh từ</option><option value="verb">Động từ</option><option value="adjective">Tính từ</option><option value="adverb">Trạng từ</option><option value="phrase">Cụm từ</option><option value="pronoun">Đại từ</option><option value="determiner">Từ hạn định</option><option value="preposition">Giới từ</option><option value="conjunction">Liên từ</option><option value="interjection">Thán từ</option><option value="numeral">Số từ</option><option value="modal">Động từ khuyết thiếu</option><option value="auxiliary">Trợ động từ</option><option value="infinitive-marker">Dấu hiệu nguyên mẫu</option><option value="other">Khác</option></select></label>
            <label>Tier<select value={draft.tier} onChange={(event) => update('tier', Number(event.target.value) as 1 | 2 | 3)}><option value="1">1 · Cơ bản</option><option value="2">2 · Phổ biến</option><option value="3">3 · Thử thách</option></select></label>
            <label>CEFR<select value={draft.cefr} onChange={(event) => update('cefr', event.target.value as CefrLevel)}><option value="">—</option>{['A1','A2','B1','B2','C1','C2'].map((level) => <option key={level}>{level}</option>)}</select></label>
          </div>
          <label>IPA<input value={draft.ipa} onChange={(event) => update('ipa', event.target.value)} placeholder="/ˌɒpəˈtjuːnəti/" /></label>
          <div className="form-grid two">
            <label>Ví dụ tiếng Anh<textarea rows={3} value={draft.exampleEn} onChange={(event) => update('exampleEn', event.target.value)} /></label>
            <label>Dịch ví dụ<textarea rows={3} value={draft.exampleVi} onChange={(event) => update('exampleVi', event.target.value)} /></label>
          </div>
          <label>Ghi chú<textarea rows={2} value={draft.notes} onChange={(event) => update('notes', event.target.value)} /></label>
          {message && <div className="form-message">{message}</div>}
          <div className="form-actions"><button type="button" className="button ghost" onClick={onClose}>Hủy</button><button className="button primary" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu mục từ'}</button></div>
        </form>
      </section>
    </div>
  )
}
