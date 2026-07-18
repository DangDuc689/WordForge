import { useEffect, useMemo, useState } from 'react'
import { loadOxfordManifest, OXFORD_LEVELS, type OxfordCatalogManifest, type OxfordLevel } from '../data/oxfordCatalog'
import { useApp } from '../context/AppContext'

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
    return () => document.body.classList.remove('modal-open')
  }, [importedLevels])

  const toggle = (level: OxfordLevel) => setSelected((current) => current.includes(level)
    ? current.filter((item) => item !== level)
    : [...current, level])

  const runImport = async () => {
    if (!selected.length) return
    setBusy(true)
    setMessage(`Đang nhập ${selected.join(', ')}… Không đóng cửa sổ này.`)
    try {
      const result = await importOxfordLevels(selected)
      setMessage(`Đã thêm ${result.created.toLocaleString('vi-VN')} thẻ; bỏ qua ${result.skipped.toLocaleString('vi-VN')} thẻ đã có.`)
      onImported(result.deckIds)
    } catch (cause) {
      setMessage(`${cause instanceof Error ? cause.message : 'Nhập catalog thất bại.'} Bạn có thể chạy lại; các thẻ đã lưu sẽ không bị nhân đôi.`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <section className="modal-card oxford-import" role="dialog" aria-modal="true" aria-labelledby="oxford-import-title">
        <div className="modal-head">
          <span><small>Vocabulary pack</small><h2 id="oxford-import-title">Nhập Oxford 3000</h2></span>
          <button className="icon-button" disabled={busy} onClick={onClose} aria-label="Đóng">×</button>
        </div>
        <div className="oxford-import-body">
          <p>Chọn cấp độ cần thêm. Mỗi từ loại là một thẻ riêng và mỗi CEFR được tạo thành một bộ từ độc lập.</p>
          <div className="oxford-level-grid">
            {OXFORD_LEVELS.map((level) => {
              const info = manifest?.levels.find((item) => item.level === level)
              const imported = importedLevels.has(level)
              return <label key={level} className={selected.includes(level) ? 'selected' : ''}>
                <input type="checkbox" checked={selected.includes(level)} disabled={busy || !manifest?.ready} onChange={() => toggle(level)} />
                <span><b>{level}</b><small>{info?.entryCount ? `${info.entryCount.toLocaleString('vi-VN')} thẻ` : 'Chưa có dữ liệu'}{imported ? ' · đã nhập' : ''}</small></span>
              </label>
            })}
          </div>
          {message && <div className="form-message">{message}</div>}
          <p className="oxford-attribution">Headword và CEFR dựa trên <a href={manifest?.sourceUrl ?? 'https://www.oxfordlearnersdictionaries.com/about/wordlists/oxford3000-5000'} target="_blank" rel="noreferrer">Oxford 3000</a>. Nghĩa Việt, IPA và ví dụ được biên soạn riêng; ứng dụng không liên kết hoặc được bảo trợ bởi OUP.</p>
          <div className="form-actions">
            <button type="button" className="button ghost" disabled={busy} onClick={onClose}>Đóng</button>
            <button type="button" className="button primary" disabled={busy || !manifest?.ready || !selected.length} onClick={() => void runImport()}>{busy ? 'Đang nhập…' : 'Nhập cấp độ đã chọn'}</button>
          </div>
        </div>
      </section>
    </div>
  )
}
