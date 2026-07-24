import { useEffect, useMemo, useState } from 'react'
import { loadOxfordManifest, OXFORD_LEVELS, type OxfordCatalogManifest, type OxfordLevel } from '../data/oxfordCatalog'
import { useApp } from '../context/AppContext'
import { CheckIcon, CloseIcon, ImportIcon } from './Icons'

interface Props {
  onClose: () => void
  onImported: (deckIds: string[]) => void
}

export function OxfordImportModal({ onClose, onImported }: Props) {
  const { snapshot, importOxfordLevels } = useApp()
  const importedLevels = useMemo(() => new Set(snapshot.decks
    .filter((deck) => deck.source === 'oxford-3000')
    .map((deck) => deck.sourceKey.split(':').at(-1)?.toUpperCase())), [snapshot.decks])
  const [manifest, setManifest] = useState<OxfordCatalogManifest | null>(null)
  const [selected, setSelected] = useState<OxfordLevel[]>([])
  const [busy, setBusy] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [message, setMessage] = useState('Đang kiểm tra catalog…')

  useEffect(() => {
    document.body.classList.add('modal-open')
    void loadOxfordManifest()
      .then((value) => {
        setManifest(value)
        const firstMissing = OXFORD_LEVELS.find((level) => !importedLevels.has(level))
        if (firstMissing && value.ready) setSelected([firstMissing])
        setMessage(value.ready ? '' : value.message)
      })
      .catch((cause) => setMessage(cause instanceof Error ? cause.message : 'Không thể đọc manifest Oxford.'))
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.classList.remove('modal-open')
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [busy, importedLevels, onClose])

  const toggle = (level: OxfordLevel) => setSelected((current) => current.includes(level)
    ? current.filter((item) => item !== level)
    : [...current, level])

  const totalWords = useMemo(() => {
    if (!manifest) return 0
    return selected.reduce((acc, level) => {
      const info = manifest.levels.find((item) => item.level === level)
      return acc + (info?.entryCount ?? 0)
    }, 0)
  }, [manifest, selected])

  const runImport = async () => {
    if (!selected.length) return
    setBusy(true)
    setStep(2)
    setMessage(`Đang tiến hành nhập ${selected.join(', ')}…`)
    try {
      const result = await importOxfordLevels(selected)
      setStep(3)
      setCompleted(true)
      setMessage(`Hoàn tất! Đã thêm ${result.created.toLocaleString('vi-VN')} từ mới; cập nhật ${result.updated.toLocaleString('vi-VN')}; bỏ qua ${result.skipped.toLocaleString('vi-VN')} từ sẵn có.`)
      setTimeout(() => onImported(result.deckIds), 1200)
    } catch (cause) {
      setStep(1)
      setMessage(`${cause instanceof Error ? cause.message : 'Nhập catalog thất bại.'} Bạn có thể thử lại mà không lo trùng lặp dữ liệu.`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <section className="modal-card oxford-import" role="dialog" aria-modal="true" aria-labelledby="oxford-import-title">
        <div className="modal-head">
          <div>
            <small className="modal-tag">Bộ Từ Chuẩn</small>
            <h2 id="oxford-import-title">Nhập Catalog Oxford 3000</h2>
          </div>
          <button className="icon-button" disabled={busy} onClick={onClose} aria-label="Đóng cửa sổ">
            <CloseIcon />
          </button>
        </div>

        {/* Workflow Stepper */}
        <div className="workflow-stepper">
          <div className={`step-item ${step === 1 ? 'active' : step > 1 ? 'completed' : ''}`}>
            <span className="step-badge">{step > 1 ? <CheckIcon width="12" height="12" /> : '1'}</span>
            <span className="step-label">Chọn Cấp Độ</span>
          </div>
          <div className="step-line" />
          <div className={`step-item ${step === 2 ? 'active' : step > 2 ? 'completed' : ''}`}>
            <span className="step-badge">{step > 3 ? <CheckIcon width="12" height="12" /> : '2'}</span>
            <span className="step-label">Tiến Hành Nhập</span>
          </div>
          <div className="step-line" />
          <div className={`step-item ${step === 3 ? 'active' : ''}`}>
            <span className="step-badge">{completed ? <CheckIcon width="12" height="12" /> : '3'}</span>
            <span className="step-label">Hoàn Thành</span>
          </div>
        </div>

        <div className="oxford-import-body">
          <p className="oxford-subtext">Chọn các cấp độ CEFR bạn muốn nạp vào kho từ vựng. Hệ thống tự động phân tách từ loại và nghĩa phụ.</p>
          
          <div className="oxford-level-grid">
            {OXFORD_LEVELS.map((level) => {
              const info = manifest?.levels.find((item) => item.level === level)
              const imported = importedLevels.has(level)
              const isSelected = selected.includes(level)
              return (
                <label key={level} className={`oxford-level-card ${isSelected ? 'selected' : ''} ${imported ? 'imported' : ''}`}>
                  <input type="checkbox" checked={isSelected} disabled={busy || !manifest?.ready} onChange={() => toggle(level)} />
                  <div className="oxford-level-info">
                    <span className="level-code">{level}</span>
                    <span className="level-count">{info?.entryCount ? `${info.entryCount.toLocaleString('vi-VN')} mục từ` : 'Chưa có dữ liệu'}{imported ? ' · Đã nạp' : ''}</span>
                  </div>
                </label>
              )
            })}
          </div>

          {selected.length > 0 && (
            <div className="import-summary-bar">
              <span>Đã chọn: <b>{selected.join(', ')}</b> (~{totalWords.toLocaleString('vi-VN')} thẻ)</span>
            </div>
          )}

          {message && <div className={`form-message ${completed ? 'success' : ''}`}>{message}</div>}
          
          <p className="oxford-attribution">Headword & CEFR theo chuẩn Oxford 3000. IPA, nghĩa Việt và ví dụ được tổng hợp tối ưu.</p>
          
          <div className="form-actions">
            <button type="button" className="button ghost" disabled={busy} onClick={onClose}>Đóng</button>
            <button type="button" className="button primary" disabled={busy || !manifest?.ready || !selected.length} onClick={() => void runImport()}>
              <ImportIcon width="16" height="16" />
              <span>{busy ? 'Đang nạp dữ liệu…' : 'Xác Nhận Nhập Catalog'}</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
