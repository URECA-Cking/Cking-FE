import { useState } from 'react'
import BottomSheet from '../ui/BottomSheet.jsx'
import { ErrorBlock, LoadingBlock } from '../ui/States.jsx'
import { useToast } from '../../context/useToast.js'
import { applyCreator, describeCreatorApplicationError, getMyCreatorApplication, resubmitCreatorApplication, updateCreatorApplication } from '../../api/creatorApplications.js'
import { getInterests } from '../../api/interests.js'
import { useAsync } from '../../hooks/useAsync.js'

const INPUT = 'mt-1 w-full rounded-xl bg-surface-container px-3 py-2.5 text-body-sm text-on-surface focus:outline-none'
const PLATFORMS = { YOUTUBE: 'YouTube', INSTAGRAM: 'Instagram', TIKTOK: 'TikTok', BLOG: '블로그', OTHER: '기타' }
const EMPTY_FORM = { preferredActivityName: '', categoryCodes: [], introduction: '', evidenceUrls: [''], activityPlan: '', platforms: [], agreeToCreatorPolicy: false }

export default function CreatorApplicationSheet({ open, application, onClose, onDone }) {
  const interests = useAsync(getInterests, [open], { enabled: open, fallbackMessage: '활동 분야를 불러오지 못했어요.' })
  const revising = application?.status === 'NEEDS_REVISION'
  const detail = useAsync(() => getMyCreatorApplication(application.applicationId), [open, application?.applicationId], { enabled: open && revising, fallbackMessage: '신청서를 불러오지 못했어요.' })
  return <BottomSheet open={open} onClose={onClose} closeOnBack eyebrow="Creator" title={revising ? '크리에이터 신청 보완' : '크리에이터 전환 신청'}>
    {detail.loading || interests.loading ? <LoadingBlock label="신청서를 준비하는 중..." /> : detail.error ? <ErrorBlock message={detail.error} onRetry={detail.reload} /> : interests.error ? <ErrorBlock message={interests.error} onRetry={interests.reload} /> : (
      <ApplicationForm key={revising ? `${application.applicationId}:${detail.data?.submissionVersion}` : 'new'} application={revising ? detail.data : null} categories={interests.data?.items ?? []} onDone={onDone} />
    )}
  </BottomSheet>
}

function ApplicationForm({ application, categories, onDone }) {
  const showToast = useToast()
  const [form, setForm] = useState(() => {
    const saved = application?.draftForm ?? application?.submittedForm ?? {}
    const activeCodes = new Set(categories.map((item) => item.interestCode))
    return { ...EMPTY_FORM, ...saved, categoryCodes: (saved.categoryCodes ?? []).filter((code) => activeCodes.has(code)), evidenceUrls: saved.evidenceUrls?.length ? saved.evidenceUrls : [''] }
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const change = (field, value) => setForm((current) => ({ ...current, [field]: value }))
  const toggle = (field, value, limit) => setForm((current) => ({ ...current, [field]: current[field].includes(value) ? current[field].filter((item) => item !== value) : current[field].length < limit ? [...current[field], value] : current[field] }))
  const updateUrl = (index, value) => change('evidenceUrls', form.evidenceUrls.map((url, position) => position === index ? value : url))

  async function submit(event) {
    event.preventDefault()
    if (!form.categoryCodes.length) { setError('활동 분야를 하나 이상 선택해주세요.'); return }
    const evidenceUrls = form.evidenceUrls.map((url) => url.trim()).filter(Boolean)
    if (!evidenceUrls.length || evidenceUrls.some((url) => { try { const parsed = new URL(url); return url.length > 2048 || parsed.protocol !== 'https:' || !parsed.hostname || Boolean(parsed.username || parsed.password) } catch { return true } })) { setError('증빙 URL은 2048자 이하의 HTTPS 주소로 입력해주세요.'); return }
    setSaving(true); setError('')
    try {
      const payload = { ...form, evidenceUrls }
      if (application) { await updateCreatorApplication(application.applicationId, payload); await resubmitCreatorApplication(application.applicationId); showToast('보완 신청서를 다시 제출했어요.') }
      else { await applyCreator(payload); showToast('크리에이터 전환 신청이 접수됐어요.') }
      onDone()
    } catch (reason) { setError(describeCreatorApplicationError(reason)) }
    finally { setSaving(false) }
  }

  return <form onSubmit={submit} className="flex flex-col gap-space-md pb-space-md">
    {application?.revisionReason && <p className="rounded-xl bg-berry-tint p-3 text-body-sm text-berry-deep">보완 요청: {application.revisionReason}</p>}
    <label className="text-label-xs text-on-surface-variant">희망 활동명<input required maxLength={20} value={form.preferredActivityName} onChange={(event) => change('preferredActivityName', event.target.value)} className={INPUT} /></label>
    <fieldset><legend className="text-label-xs text-on-surface-variant">활동 분야 ({form.categoryCodes.length}/3)</legend><div className="mt-2 flex flex-wrap gap-2">{categories.map((item) => { const active = form.categoryCodes.includes(item.interestCode); return <button key={item.interestCode} type="button" aria-pressed={active} onClick={() => toggle('categoryCodes', item.interestCode, 3)} className={`rounded-full px-3 py-2 text-label-sm ${active ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}`}>{item.name}</button> })}</div></fieldset>
    <label className="text-label-xs text-on-surface-variant">소개 (30~500자)<textarea required minLength={30} maxLength={500} rows={4} value={form.introduction} onChange={(event) => change('introduction', event.target.value)} className={INPUT} /></label>
    <fieldset><legend className="text-label-xs text-on-surface-variant">증빙 URL (1~3개)</legend><div className="flex flex-col gap-2">{form.evidenceUrls.map((url, index) => <div key={index} className="flex gap-2"><input type="url" required maxLength={2048} value={url} onChange={(event) => updateUrl(index, event.target.value)} className={INPUT} placeholder="https://" aria-label={`증빙 URL ${index + 1}`} />{form.evidenceUrls.length > 1 && <button type="button" onClick={() => change('evidenceUrls', form.evidenceUrls.filter((_, position) => position !== index))} className="text-label-sm text-on-surface-variant">삭제</button>}</div>)}{form.evidenceUrls.length < 3 && <button type="button" onClick={() => change('evidenceUrls', [...form.evidenceUrls, ''])} className="self-start text-label-sm text-primary">+ URL 추가</button>}</div></fieldset>
    <label className="text-label-xs text-on-surface-variant">활동 계획 (50~1000자)<textarea required minLength={50} maxLength={1000} rows={5} value={form.activityPlan} onChange={(event) => change('activityPlan', event.target.value)} className={INPUT} /></label>
    <fieldset><legend className="text-label-xs text-on-surface-variant">활동 플랫폼 (선택)</legend><div className="mt-2 flex flex-wrap gap-2">{Object.entries(PLATFORMS).map(([code, label]) => { const active = form.platforms.includes(code); return <button key={code} type="button" aria-pressed={active} onClick={() => toggle('platforms', code, 5)} className={`rounded-full px-3 py-2 text-label-sm ${active ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}`}>{label}</button> })}</div></fieldset>
    <label className="flex gap-2 text-body-sm text-on-surface-variant"><input type="checkbox" required checked={form.agreeToCreatorPolicy} onChange={(event) => change('agreeToCreatorPolicy', event.target.checked)} />크리에이터 운영 정책을 확인하고 동의합니다.</label>
    {error && <p role="alert" className="text-label-xs text-error">{error}</p>}
    <button type="submit" disabled={saving} className="h-11 rounded-xl bg-primary text-label-md font-bold text-on-primary disabled:opacity-50">{saving ? '제출하는 중...' : application ? '보완 후 다시 제출' : '크리에이터 전환 신청하기'}</button>
  </form>
}
