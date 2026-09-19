import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import MaterialIcon from '../../components/ui/MaterialIcon.jsx'
import { BackHeader } from '../../components/layout/TopHeader.jsx'
import { LoadingBlock, ErrorBlock } from '../../components/ui/States.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { useUser } from '../../context/UserContext.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { createCreatorEvent, getMyCreatorEvents, updateCreatorEvent } from '../../api/creatorEvents.js'
import { describeError, newRequestId } from '../../api/client.js'
import { formatNumber } from '../../utils/format.js'

const EMPTY_PRIZE = { prizeKey: '', displayName: '', priority: 1, weight: 100, quantity: 1 }

/** Instant(ISO, UTC) -> datetime-local 입력값(로컬 시각). */
function toLocalInput(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`
}

/** datetime-local 입력값 -> Instant(ISO, UTC). */
function toInstant(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function defaultRange() {
  const start = new Date(Date.now() + 60 * 60 * 1000)
  const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  return { startAt: toLocalInput(start.toISOString()), endAt: toLocalInput(end.toISOString()) }
}

/**
 * 이벤트 생성/수정 폼.
 *
 * 백엔드 검증 규칙을 그대로 따른다.
 *  - 제목 필수, 시작 < 종료, 당첨 인원 >= 1, 추첨 방식은 WEIGHTED
 *  - 상품 등급: prizeKey는 영문·숫자·_·- 만, 중복 불가, priority/weight/quantity는 양수
 *  - 상품을 등록했다면 총 수량 >= 당첨 인원
 * 생성은 requestId(UUID)로 멱등 처리되므로, 같은 폼에서 재시도해도 중복 생성되지 않는다.
 */
export default function StudioEventForm() {
  const { eventId } = useParams()
  const isEdit = Boolean(eventId)
  const navigate = useNavigate()
  const { userId } = useUser()

  // 수정 모드에서는 내 이벤트 목록에서 해당 이벤트를 찾아 초기값으로 쓴다.
  // (크리에이터 이벤트 목록 응답에는 description이 없어 설명은 새로 입력해야 한다.)
  const existing = useAsync(() => getMyCreatorEvents(userId, { size: 100 }), [userId], {
    enabled: isEdit,
    fallbackMessage: '이벤트 정보를 불러오지 못했습니다.',
  })

  const target = useMemo(
    () => (existing.data?.items ?? []).find((item) => String(item.eventId) === String(eventId)) ?? null,
    [existing.data, eventId],
  )

  if (isEdit && existing.loading) {
    return (
      <div className="flex flex-col w-full min-h-screen pt-safe">
        <BackHeader title="이벤트 수정" onBack={() => navigate('/studio')} />
        <LoadingBlock label="이벤트를 불러오는 중..." />
      </div>
    )
  }

  if (isEdit && (existing.error || !target)) {
    return (
      <div className="flex flex-col w-full min-h-screen pt-safe justify-center">
        <ErrorBlock message={existing.error ?? '수정할 이벤트를 찾을 수 없어요.'} onRetry={existing.reload} />
      </div>
    )
  }

  return <EventFormBody eventId={eventId} isEdit={isEdit} target={target} userId={userId} />
}

function EventFormBody({ eventId, isEdit, target, userId }) {
  const navigate = useNavigate()
  const showToast = useToast()

  const [requestId] = useState(() => newRequestId())
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)
  const [form, setForm] = useState(() =>
    target
      ? {
          title: target.title ?? '',
          description: '',
          winnerCount: target.winnerCount ?? 1,
          startAt: toLocalInput(target.startAt),
          endAt: toLocalInput(target.endAt),
          prizes: (target.prizes ?? []).length
            ? target.prizes.map((prize) => ({ ...prize }))
            : [{ ...EMPTY_PRIZE, prizeKey: 'GRAND', displayName: '1등 상품' }],
        }
      : {
          title: '',
          description: '',
          winnerCount: 1,
          prizes: [{ ...EMPTY_PRIZE, prizeKey: 'GRAND', displayName: '1등 상품' }],
          ...defaultRange(),
        },
  )

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function updatePrize(index, key, value) {
    setForm((prev) => ({
      ...prev,
      prizes: prev.prizes.map((prize, i) => (i === index ? { ...prize, [key]: value } : prize)),
    }))
  }

  function addPrize() {
    setForm((prev) => ({
      ...prev,
      prizes: [...prev.prizes, { ...EMPTY_PRIZE, priority: prev.prizes.length + 1 }],
    }))
  }

  function removePrize(index) {
    setForm((prev) => ({ ...prev, prizes: prev.prizes.filter((_, i) => i !== index) }))
  }

  const totalQuantity = form.prizes.reduce((sum, prize) => sum + (Number(prize.quantity) || 0), 0)

  /** 백엔드와 동일한 규칙으로 미리 검증해 불필요한 400 왕복을 줄인다. */
  function validate() {
    if (!form.title.trim()) return '제목을 입력해주세요.'
    const startAt = toInstant(form.startAt)
    const endAt = toInstant(form.endAt)
    if (!startAt || !endAt) return '시작/종료 시각을 모두 입력해주세요.'
    if (new Date(startAt) >= new Date(endAt)) return '종료 시각은 시작 시각보다 뒤여야 해요.'
    if (Number(form.winnerCount) < 1) return '당첨 인원은 1명 이상이어야 해요.'

    const keys = new Set()
    for (const prize of form.prizes) {
      if (!prize.prizeKey?.trim() || !prize.displayName?.trim()) return '상품 등급의 키와 이름을 입력해주세요.'
      if (!/^[A-Za-z0-9_-]+$/.test(prize.prizeKey)) return '상품 키는 영문, 숫자, _, - 만 사용할 수 있어요.'
      if (keys.has(prize.prizeKey)) return `상품 키 "${prize.prizeKey}"가 중복됐어요.`
      keys.add(prize.prizeKey)
      if (Number(prize.priority) < 1 || Number(prize.weight) < 1 || Number(prize.quantity) < 1) {
        return '상품의 순위·가중치·수량은 1 이상이어야 해요.'
      }
    }
    if (form.prizes.length > 0 && totalQuantity < Number(form.winnerCount)) {
      return `상품 총 수량(${totalQuantity}개)이 당첨 인원(${form.winnerCount}명)보다 적어요.`
    }
    return null
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const message = validate()
    if (message) {
      setFormError(message)
      return
    }
    setFormError(null)
    setSubmitting(true)

    const payload = {
      userId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      startAt: toInstant(form.startAt),
      endAt: toInstant(form.endAt),
      winnerCount: Number(form.winnerCount),
      drawMethod: 'WEIGHTED',
      prizes: form.prizes.map((prize) => ({
        prizeKey: prize.prizeKey.trim(),
        displayName: prize.displayName.trim(),
        priority: Number(prize.priority),
        weight: Number(prize.weight),
        quantity: Number(prize.quantity),
      })),
    }

    try {
      if (isEdit) {
        await updateCreatorEvent(eventId, payload)
        showToast('이벤트를 수정했어요.')
      } else {
        await createCreatorEvent({ ...payload, requestId })
        showToast('이벤트 초안을 만들었어요. 승인 요청을 보내면 심사가 시작돼요.')
      }
      navigate('/studio', { replace: true })
    } catch (err) {
      setFormError(describeError(err, '저장에 실패했습니다. 입력값을 확인해주세요.'))
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'w-full h-11 px-3.5 rounded-xl bg-surface-container text-on-surface font-body-md text-body-md placeholder:text-outline focus:bg-surface-container-lowest focus:outline-none shadow-sm transition-all'
  const labelClass = 'font-label-sm text-label-sm text-on-surface font-semibold'

  return (
    <div className="flex flex-col w-full min-h-screen pt-safe pb-32">
      <BackHeader title={isEdit ? '이벤트 수정' : '새 이벤트 만들기'} onBack={() => navigate('/studio')} />

      <form onSubmit={handleSubmit} className="pt-16 px-margin flex flex-col gap-space-md">
        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="event-title">
            제목 <span className="text-primary">*</span>
          </label>
          <input
            id="event-title"
            className={inputClass}
            value={form.title}
            maxLength={200}
            onChange={(e) => updateField('title', e.target.value)}
            placeholder="예: 팬미팅 초대권 드로우"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelClass} htmlFor="event-description">
            설명
          </label>
          <textarea
            id="event-description"
            rows={4}
            className="w-full p-3.5 rounded-xl bg-surface-container text-on-surface font-body-md text-body-md placeholder:text-outline focus:bg-surface-container-lowest focus:outline-none shadow-sm transition-all resize-none"
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
            placeholder="이벤트 상세 설명, 당첨 혜택 등을 적어주세요."
          />
          {isEdit && (
            <p className="font-label-xs text-label-xs text-outline">
              크리에이터 이벤트 목록 API가 설명을 내려주지 않아 수정 시에는 설명을 다시 입력해야 해요.
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-space-sm">
          <div className="flex flex-col gap-1.5">
            <label className={labelClass} htmlFor="event-start">
              시작 <span className="text-primary">*</span>
            </label>
            <input
              id="event-start"
              type="datetime-local"
              className={inputClass}
              value={form.startAt}
              onChange={(e) => updateField('startAt', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass} htmlFor="event-end">
              종료 <span className="text-primary">*</span>
            </label>
            <input
              id="event-end"
              type="datetime-local"
              className={inputClass}
              value={form.endAt}
              onChange={(e) => updateField('endAt', e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-space-sm">
          <div className="flex flex-col gap-1.5">
            <label className={labelClass} htmlFor="event-winner-count">
              당첨 인원 <span className="text-primary">*</span>
            </label>
            <input
              id="event-winner-count"
              type="number"
              min={1}
              className={inputClass}
              value={form.winnerCount}
              onChange={(e) => updateField('winnerCount', e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass} htmlFor="event-draw-method">
              추첨 방식
            </label>
            <input
              id="event-draw-method"
              className={`${inputClass} opacity-70`}
              value="WEIGHTED (응모권 가중 추첨)"
              readOnly
            />
          </div>
        </div>

        <section className="flex flex-col gap-space-sm p-space-md rounded-2xl bg-surface-container-low">
          <div className="flex items-center justify-between">
            <h3 className="font-title-md text-title-md text-on-surface font-bold">상품 등급</h3>
            <span
              className={`font-label-xs text-label-xs font-semibold ${
                form.prizes.length > 0 && totalQuantity < Number(form.winnerCount) ? 'text-error' : 'text-on-surface-variant'
              }`}
            >
              총 {formatNumber(totalQuantity)}개 / 당첨 {formatNumber(form.winnerCount)}명
            </span>
          </div>

          {form.prizes.map((prize, index) => (
            <div key={index} className="p-space-sm rounded-xl bg-surface-container-lowest flex flex-col gap-2 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-label-sm text-primary font-bold">등급 {index + 1}</span>
                {form.prizes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePrize(index)}
                    className="text-outline hover:text-error"
                    aria-label="상품 등급 삭제"
                  >
                    <MaterialIcon name="delete" className="text-[18px]" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className={inputClass}
                  value={prize.prizeKey}
                  onChange={(e) => updatePrize(index, 'prizeKey', e.target.value)}
                  placeholder="키 (예: GRAND)"
                  aria-label={`상품 ${index + 1} 키`}
                />
                <input
                  className={inputClass}
                  value={prize.displayName}
                  onChange={(e) => updatePrize(index, 'displayName', e.target.value)}
                  placeholder="표시 이름"
                  aria-label={`상품 ${index + 1} 이름`}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={prize.priority}
                  onChange={(e) => updatePrize(index, 'priority', e.target.value)}
                  placeholder="순위"
                  aria-label={`상품 ${index + 1} 순위`}
                />
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={prize.weight}
                  onChange={(e) => updatePrize(index, 'weight', e.target.value)}
                  placeholder="가중치"
                  aria-label={`상품 ${index + 1} 가중치`}
                />
                <input
                  type="number"
                  min={1}
                  className={inputClass}
                  value={prize.quantity}
                  onChange={(e) => updatePrize(index, 'quantity', e.target.value)}
                  placeholder="수량"
                  aria-label={`상품 ${index + 1} 수량`}
                />
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addPrize}
            className="h-10 rounded-xl bg-berry-tint text-primary font-label-md text-label-md font-bold active:scale-[0.98] transition-all"
          >
            + 상품 등급 추가
          </button>
        </section>

        {formError && (
          <p className="p-space-sm rounded-xl bg-error-container text-on-error-container font-body-sm text-body-sm">
            {formError}
          </p>
        )}
      </form>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] z-40 bg-surface-glass backdrop-blur-2xl px-space-md pt-3 pb-6 shadow-[0_-8px_24px_rgba(15,23,42,0.06)]">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full h-12 rounded-xl bg-primary text-on-primary font-title-md text-title-md font-bold shadow-lg active:scale-[0.98] transition-all disabled:opacity-60"
        >
          {submitting ? '저장 중...' : isEdit ? '수정 저장' : '이벤트 초안 만들기'}
        </button>
      </div>
    </div>
  )
}
