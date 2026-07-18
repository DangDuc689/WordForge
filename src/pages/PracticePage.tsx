import { useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { useApp } from '../context/AppContext'
import type { AiPracticeSet } from '../domain/types'
import { generatePractice } from '../lib/ai'

export function PracticePage() {
  const { snapshot, savePractice } = useApp()
  const [deckId, setDeckId] = useState<string>('all')
  const [format, setFormat] = useState<'reading' | 'quiz'>('reading')
  const [practice, setPractice] = useState<AiPracticeSet | null>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const create = async () => {
    if (!snapshot.profile.aiEnabled) { setMessage('Hãy bật AI trong Cài đặt trước.'); return }
    setBusy(true); setMessage(''); setSubmitted(false); setAnswers({})
    try {
      const result = await generatePractice(deckId === 'all' ? null : deckId, format)
      setPractice(result)
      const ids = result.questions.map((question) => question.vocabularyId).filter((id): id is string => Boolean(id))
      await savePractice(deckId === 'all' ? null : deckId, format, ids, result)
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'Không thể tạo bài luyện.') }
    finally { setBusy(false) }
  }

  const score = practice ? practice.questions.filter((question) => answers[question.id] === question.answer).length : 0
  return <div className="page practice-page">
    <PageHeader eyebrow="Context from your history" title={<>Luyện tập với <span className="accent">AI</span></>} description="AI dùng từ đến hạn, từ yếu và những từ bạn đã nhớ — không tự đoán trình độ của bạn." />
    <section className="panel practice-builder">
      <label>Bộ từ<select value={deckId} onChange={(event) => setDeckId(event.target.value)}><option value="all">Tất cả bộ từ</option>{snapshot.decks.map((deck) => <option key={deck.id} value={deck.id}>{deck.name}</option>)}</select></label>
      <div className="segmented"><button className={format === 'reading' ? 'active' : ''} onClick={() => setFormat('reading')}>Bài đọc ngắn</button><button className={format === 'quiz' ? 'active' : ''} onClick={() => setFormat('quiz')}>Quiz ngữ cảnh</button></div>
      <button className="button primary" disabled={busy || !snapshot.profile.aiEnabled} onClick={() => void create()}>{busy ? 'Đang tạo ngữ cảnh…' : '◇ Tạo bài luyện'}</button>
    </section>
    {message && <div className="notice danger">{message}</div>}
    {!practice && <section className="panel ai-empty"><span>◇</span><h2>Một bài luyện chỉ dành cho bạn</h2><p>Những từ đã biết giúp AI viết câu dễ hiểu; từ yếu và đến hạn trở thành trọng tâm của bài.</p></section>}
    {practice && <section className="panel generated-practice"><span className="eyebrow">AI generated · Hãy kiểm tra nội dung</span><h2>{practice.title}</h2>{practice.passage && <article><p>{practice.passage}</p><details><summary>Xem bản dịch tham khảo</summary><p>{practice.passageVi}</p></details></article>}
      <div className="question-list">{practice.questions.map((question, index) => <fieldset key={question.id}><legend>{index + 1}. {question.prompt}</legend>{question.choices.map((choice) => <label key={choice} className={submitted ? choice === question.answer ? 'right-choice' : answers[question.id] === choice ? 'wrong-choice' : '' : ''}><input type="radio" name={question.id} value={choice} disabled={submitted} checked={answers[question.id] === choice} onChange={() => setAnswers((state) => ({ ...state, [question.id]: choice }))} />{choice}</label>)}{submitted && <p className="explanation">{question.explanation}</p>}</fieldset>)}</div>
      <div className="form-actions">{submitted ? <strong>Kết quả: {score}/{practice.questions.length}</strong> : <button className="button primary" disabled={Object.keys(answers).length < practice.questions.length} onClick={() => setSubmitted(true)}>Chấm bài</button>}<button className="button ghost" onClick={() => void create()}>Tạo bài khác</button></div>
    </section>}
  </div>
}
