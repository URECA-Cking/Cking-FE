import { useEffect, useRef, useState } from 'react'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import { ErrorBlock, StatusPill } from '../ui/States.jsx'
import { composeQuizRevision, getMyQuiz, getMyQuizRevision } from '../../api/creatorQuizzes.js'
import { newRequestId } from '../../api/client.js'
import { browserStorage, creatorQuizErrorMessage } from '../../utils/quizJobs.js'
import { compositionBody, compositionDraft, compositionKey, compositionLock, compositionStatus, readComposition, releaseRejectedComposition, reserveComposition, restoreCompositionDraft, settleComposition } from '../../utils/quizComposition.js'

const fieldClass = 'w-full rounded-lg bg-surface-container-lowest p-space-sm text-on-surface outline-none focus:ring-2 focus:ring-primary'
const buttonClass = 'rounded-xl px-3 py-2 font-label-sm text-label-sm bg-surface-container text-on-surface disabled:opacity-50'
const labels = { PASS: '원본 통과', FAIL: '원본 미통과', UNCERTAIN: '원본 판단 보류', NOT_REVALIDATED: '수정됨 · 재검증 안 됨', NOT_EVALUATED: '평가 없음' }

export default function QuizCompositionPanel({ creatorId, quizId, revision, onSaved, onClose, onQuizClosed }) {
  const key = compositionKey(creatorId, quizId), storage = browserStorage()
  const [draft, setDraft] = useState(() => {
    const saved = readComposition(storage, key).entry
    if (saved) {
      try { return restoreCompositionDraft(revision, saved.body) } catch { /* 다른 기준이나 잘못된 본문은 화면에 복원하지 않는다. */ }
    }
    return compositionDraft(revision)
  })
  const [record, setRecord] = useState(() => readComposition(storage, key).entry)
  const [busy, setBusy] = useState(false), [error, setError] = useState(null), [preview, setPreview] = useState(false)
  const [locked, setLocked] = useState(revision.contentLocked), [latest, setLatest] = useState(null)
  const inFlight = useRef(false), active = useRef(true)
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  useEffect(() => {
    const sync = e => { if (e.key !== null && e.key !== key) return; const saved = readComposition(storage, key); if (saved.ok) setRecord(saved.entry) }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [key, storage])
  const selected = draft.filter(q => q.selected)
  const unresolved = record && !record.result
  let currentBody = null
  try { currentBody = compositionBody(revision, draft) } catch { /* 유효하지 않은 편집본도 다른 탭의 성공으로 취급하지 않는다. */ }
  const sameBody = currentBody !== null && JSON.stringify(record?.body) === JSON.stringify(currentBody)
  const result = sameBody ? record?.result : null
  const successfulConflict = !!record?.result && record.body.baseRevisionId === revision.revisionId && !sameBody
  function change(id, update) {
    setDraft(items => items.map(q => q.id === id ? { ...q, ...update,
      edited: !!q.sourceQuestionId || q.edited, sourceEvidence: q.edited ? q.sourceEvidence : '', ...update } : q))
  }
  function move(id, direction) {
    setDraft(items => {
      const ordered = items.filter(q => q.selected), index = ordered.findIndex(q => q.id === id), target = index + direction
      if (target < 0 || target >= ordered.length) return items
      ;[ordered[index], ordered[target]] = [ordered[target], ordered[index]]
      return [...ordered, ...items.filter(q => !q.selected)]
    })
  }
  async function openSaved(saved) {
    try {
      const data = await getMyQuizRevision(quizId, saved.revisionId)
      if (data.revisionId !== saved.revisionId || data.revisionSha256 !== saved.revisionSha256) throw new Error('저장한 Revision과 조회 결과가 다릅니다.')
      if (active.current) onSaved(data)
    } catch {
      if (active.current) setError('문항은 저장됐어요. 저장된 Revision을 다시 불러와 승인해 주세요. 다시 저장하지 않습니다.')
    }
  }
  async function save(recover = false) {
    if (inFlight.current || locked) return
    let body
    try {
      const current = readComposition(storage, key)
      if (!current.ok) throw Error('저장소를 읽을 수 없어 저장을 중단했어요.')
      body = recover && current.entry ? current.entry.body : compositionBody(revision, draft)
      if (current.entry?.result && current.entry.body.baseRevisionId === revision.revisionId) {
        setRecord(current.entry)
        if (!currentBody || JSON.stringify(current.entry.body) !== JSON.stringify(currentBody)) {
          setError('다른 탭이 다른 내용으로 저장했어요. 작성 내용은 보존했습니다. 최신 Revision을 확인해 주세요.')
          return
        }
        await openSaved(current.entry.result)
        return
      }
    } catch (e) { setError(e.message); return }
    inFlight.current = true; setBusy(true); setError(null)
    const reserved = await compositionLock(key, () => reserveComposition(storage, key, body, newRequestId()))
    if (!reserved.ok) {
      if (active.current) { setRecord(reserved.entry ?? record); setError('저장 정보를 예약하지 못했어요. 저장소·Web Locks 또는 다른 탭의 미확정 요청을 확인해 주세요.'); setBusy(false) }
      inFlight.current = false; return
    }
    if (active.current) setRecord(reserved.entry)
    try {
      if (reserved.entry.result) {
        if (currentBody && JSON.stringify(reserved.entry.body) === JSON.stringify(currentBody)) await openSaved(reserved.entry.result)
        else if (active.current) setError('다른 요청의 저장 결과를 확인했어요. 작성 내용을 보존했으니 최신 Revision을 확인해 주세요.')
        return
      }
      const response = await composeQuizRevision(quizId, { ...reserved.entry.body, requestId: reserved.entry.requestId })
      if (!response?.revisionId || !/^[0-9a-f]{64}$/.test(response.revisionSha256 ?? '')) throw Error('저장 결과의 Revision 정보를 확인하지 못했어요.')
      const saved = await compositionLock(key, () => settleComposition(storage, key, reserved.entry.requestId, response))
      if (!active.current) return
      if (!saved.applied) { setError('다른 탭의 최신 저장 정보를 보호했어요. 저장 기록을 다시 확인해 주세요.'); return }
      setRecord(saved.entry)
      if (currentBody && JSON.stringify(reserved.entry.body) === JSON.stringify(currentBody)) await openSaved(response)
      else setError('다른 요청의 저장 결과를 확인했어요. 작성 내용을 보존했으니 최신 Revision을 확인해 주세요.')
    } catch (e) {
      const failed = await compositionLock(key, () => settleComposition(storage, key, reserved.entry.requestId, null, { code: e.code ?? 'NETWORK_ERROR', status: e.status ?? 0 }))
      if (!active.current) return
      if (failed.ok) setRecord(failed.entry)
      if (e.code === 'QUIZ_CONTENT_LOCKED' || e.code === 'QUIZ_CLOSED') setLocked(true)
      if (e.code === 'QUIZ_CLOSED') onQuizClosed?.()
      setError(e.code === 'QUIZ_REVISION_CONFLICT' ? '기준 Revision이 바뀌었어요. 작성 내용은 보존했습니다. 최신본을 확인해 주세요.'
        : e.code === 'QUIZ_EDIT_REQUEST_CONFLICT' ? '같은 UUID의 요청 본문이 달라요. 기존 저장 기록을 확인해 주세요.'
        : creatorQuizErrorMessage(e, '저장 결과를 확인하지 못했어요. 기존 UUID와 본문으로 다시 확인해 주세요.'))
    } finally {
      inFlight.current = false
      if (active.current) setBusy(false)
    }
  }
  async function checkLatest() {
    try {
      const quiz = await getMyQuiz(quizId), id = quiz.revisions.at(-1)?.revisionId
      const data = await getMyQuizRevision(quizId, id)
      if (active.current) { setLatest(data); setLocked(data.contentLocked) }
    } catch (e) { if (active.current) setError(creatorQuizErrorMessage(e, '최신본을 확인하지 못했어요.')) }
  }
  async function useLatest() {
    if (!latest || inFlight.current || !window.confirm('현재 편집본 대신 최신 Revision에서 새 편집을 시작할까요?')) return
    if (successfulConflict) {
      const checked = await compositionLock(key, () => {
        const current = readComposition(storage, key)
        return { ok: current.ok && current.entry?.requestId === record.requestId
          && current.entry.result?.revisionId === record.result.revisionId
          && current.entry.result?.revisionSha256 === record.result.revisionSha256 }
      })
      if (!active.current) return
      if (!checked.ok) { setError('다른 탭의 저장 기록이 바뀌었어요. 최신 Revision을 다시 확인해 주세요.'); return }
      onSaved(latest)
      return
    }
    const cleared = await compositionLock(key, () => releaseRejectedComposition(storage, key, record?.requestId))
    if (!active.current) return
    if (!cleared.applied) { setError('다른 탭의 저장 정보가 바뀌었거나 접수 여부가 불확실해 기존 요청을 보존했어요.'); return }
    onSaved(latest)
  }
  return (
    <section className="flex flex-col gap-space-md" aria-label="최종 문항 구성">
      <div className="flex justify-between items-center"><h3 className="font-semibold">최종 문항 구성 · {selected.length}/5</h3><button className={buttonClass} disabled={busy} onClick={onClose}>편집 닫기</button></div>
      <p className="text-sm text-on-surface-variant">원본 평가와 관계없이 선택할 수 있어요. 수정·추가 문항은 재평가하지 않으며 최종 내용은 Creator가 책임 승인합니다.</p>
      {locked && <p role="status">최초 게시 이후에는 게시를 취소해도 편집할 수 없어요. 새 Quiz를 생성해 주세요.</p>}
      {error && <ErrorBlock message={error} />}
      {successfulConflict && <div className="rounded-xl p-space-sm bg-surface-container" role="status"><p>다른 탭이 다른 내용으로 저장했어요. 현재 작성 내용은 보존했으며 이 탭의 저장 성공으로 처리하지 않습니다.</p><button className={buttonClass} disabled={busy} onClick={checkLatest}>최신 Revision 확인</button></div>}
      {unresolved && <div className="rounded-xl p-space-sm bg-surface-container"><p>미확정 저장 요청이 있어요. 변경한 내용으로 새 요청을 보내지 않고 기존 본문으로 복구합니다.</p><button className={buttonClass} disabled={busy || locked} onClick={() => save(true)}>기존 저장 요청 다시 확인</button><button className={buttonClass} disabled={busy} onClick={checkLatest}>최신 Revision 확인</button></div>}
      {result && <button className={buttonClass} disabled={busy} onClick={() => openSaved(result)}>저장된 Revision 다시 열기</button>}
      {latest && <div className="rounded-xl bg-surface-container p-space-sm"><p>최신 revision {latest.revisionNo} · {latest.title}</p>{latest.questions.map(q => <p key={q.questionId}>{q.questionNo + 1}. {q.question}</p>)}<p>현재 작성 내용은 그대로 보존했습니다. 계속 검토하거나, 명시적으로 최신 기준에서 다시 시작할 수 있어요.</p>{(successfulConflict || record?.failure?.code === 'QUIZ_REVISION_CONFLICT') && latest.canEdit && <button className={buttonClass} disabled={busy} onClick={useLatest}>최신 기준으로 다시 시작</button>}</div>}
      <fieldset disabled={busy || locked} className="flex flex-col gap-space-sm">
        {draft.map(q => <article key={q.id} className="rounded-xl bg-surface-container-low p-space-md flex flex-col gap-space-xs">
          <div className="flex items-center gap-2"><label><input type="checkbox" checked={q.selected} onChange={e => setDraft(items => items.map(item => item.id === q.id ? { ...item, selected: e.target.checked } : item))} /> 게시 대상으로 선택</label><StatusPill label={labels[compositionStatus(q)] ?? '평가 없음'} /></div>
          {q.selected && <div className="flex gap-2 items-center"><span>문항 {selected.findIndex(item => item.id === q.id) + 1}</span><button className={buttonClass} disabled={selected[0]?.id === q.id} onClick={() => move(q.id, -1)} aria-label={`${q.question} 위로`}>↑</button><button className={buttonClass} disabled={selected.at(-1)?.id === q.id} onClick={() => move(q.id, 1)} aria-label={`${q.question} 아래로`}>↓</button></div>}
          <label>문제<textarea aria-label={`문제 ${q.id}`} className={fieldClass} value={q.question} maxLength={500} onChange={e => change(q.id, { question: e.target.value })} /></label>
          {q.options.map((option, index) => <label className="flex gap-2 items-center" key={index}><input type="radio" name={`answer-${q.id}`} checked={q.correctOptionIndex === index} onChange={() => change(q.id, { correctOptionIndex: index })} aria-label={`정답 ${index + 1} ${q.id}`} /><input aria-label={`보기 ${index + 1} ${q.id}`} className={fieldClass} value={option} maxLength={200} onChange={e => change(q.id, { options: q.options.map((o, i) => i === index ? e.target.value : o) })} /></label>)}
          <label>해설<textarea className={fieldClass} value={q.explanation} maxLength={1000} onChange={e => change(q.id, { explanation: e.target.value })} /></label>
          <label>근거 (수정·추가 시 선택)<textarea className={fieldClass} value={q.sourceEvidence} maxLength={1000} onChange={e => change(q.id, { sourceEvidence: e.target.value })} /></label>
          {q.sourceEvaluation && <details><summary>AI 원본 참고 평가 · 현재 수정 문항의 검증 결과가 아닙니다</summary>{Object.entries(q.sourceEvaluation.items).map(([name, item]) => <p key={name}>{name}: {item.verdict} · {item.reason}</p>)}</details>}
          {!q.sourceQuestionId && <button className={buttonClass} onClick={() => setDraft(items => items.filter(item => item.id !== q.id))}>추가 문항 삭제</button>}
        </article>)}
        <button className={buttonClass} disabled={selected.length >= 5} onClick={() => setDraft(items => [...items, { id: `new:${newRequestId()}`, selected: true, question: '', options: ['', '', '', ''], correctOptionIndex: null, explanation: '', sourceEvidence: '', evaluationStatus: 'NOT_EVALUATED' }])}><MaterialIcon name="add" /> 직접 문항 추가</button>
      </fieldset>
      <div className="flex gap-2"><button className={buttonClass} onClick={() => setPreview(value => !value)}>최종 미리보기</button><button className={`${buttonClass} bg-primary text-on-primary`} disabled={busy || locked || successfulConflict || selected.length < 1 || selected.length > 5 || !!result} onClick={() => save()}>{busy ? '저장 중...' : '최종 문항 저장'}</button></div>
      {preview && <div aria-label="최종 미리보기" className="rounded-xl bg-surface-container p-space-md">{selected.map((q, i) => <article key={q.id}><h4>{i + 1}. {q.question}</h4>{q.options.map((o, j) => <p key={j}>{j + 1}. {o}{j === q.correctOptionIndex ? ' (정답)' : ''}</p>)}<p>해설: {q.explanation}</p><p>근거: {q.sourceEvidence || '근거 없음'}</p><p>{labels[compositionStatus(q)]}</p></article>)}</div>}
    </section>
  )
}
