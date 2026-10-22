import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import MaterialIcon from '../components/ui/MaterialIcon.jsx'
import { BackHeader } from '../components/layout/TopHeader.jsx'
import { LoadingBlock, ErrorBlock } from '../components/ui/States.jsx'
import ConfirmSheet from '../components/ui/ConfirmSheet.jsx'
import { useToast } from '../context/useToast.js'
import { useAsync } from '../hooks/useAsync.js'
import { useAppBack } from '../hooks/useAppBack.js'
import { Spinner } from '../components/ui/States.jsx'
import {
  createCreatorEvent,
  describeEventBannerError,
  getAllMyCreatorEvents,
  requestEventApproval,
  updateCreatorEvent,
  uploadEventBannerImage,
} from '../api/creatorEvents.js'
import { getMySpace, spacePath } from '../api/creatorSpace.js'
import { newRequestId } from '../api/client.js'
import { describeCreatorWriteError } from '../api/creatorProfile.js'
import { useImageUploadPick } from '../hooks/useImageUploadPick.js'
import { formatNumber } from '../utils/format.js'
import { allocatePrizeKey } from '../utils/eventPrizeKeys.js'
import { validateEventBannerImage } from '../utils/imageValidation.js'
import { toSafeHttpUrl } from '../utils/safeUrl.js'

// 화면에는 이해하기 쉬운 이름을 표시하고 API에는 DrawMethod 값을 전달한다.
const DRAW_METHOD_LABELS = {
  UNIFORM: '동일 확률 추첨',
  WEIGHTED: '응모권 수 비례 추첨',
}

/** 포인터나 키보드 초점이 머무는 동안 입력 항목의 설명을 표시한다. */
function FieldHelp({ label, centered = false, children }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  return (
    <span className="relative inline-flex shrink-0" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label={`${label} 도움말`}
        aria-describedby={open ? id : undefined}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false) }}
        className="flex h-4 w-4 items-center justify-center rounded-full text-outline hover:text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 7.5a2 2 0 1 1 3 1.73c-.7.4-1 1-1 1.77M10 14h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <span id={id} role="tooltip" className={`absolute bottom-full z-50 w-56 pb-2 ${centered ? "left-1/2 -translate-x-1/2" : "right-0"}`}>
          <span className="block rounded-xl bg-surface-container-high p-3 font-body-sm text-body-sm text-on-surface shadow-lg ring-1 ring-outline/30">
            {children}
          </span>
        </span>
      )}
    </span>
  )
}

const EMPTY_PRIZE = { prizeKey: '', displayName: '', priority: '', weight: '', quantity: '' }

/** 서버의 UTC 시각을 브라우저 로컬 날짜·시간 입력값으로 바꾼다. */
function toLocalInput(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`
}

/** 브라우저 로컬 날짜·시간 입력값을 서버에 보낼 UTC 시각으로 바꾼다. */
function toInstant(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** 승인 요청 최소 사전 시간(운영 48시간)에 여유를 둔 새 이벤트 기본 범위를 만든다. */
function defaultRange() {
  const start = new Date(Date.now() + 72 * 60 * 60 * 1000)
  const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  return { startAt: toLocalInput(start.toISOString()), endAt: toLocalInput(end.toISOString()) }
}

/**
 * 이벤트 생성/수정 폼.
 *
 * 백엔드 검증 규칙을 그대로 따른다.
 *  - 제목 필수, 시작 < 종료, 당첨 인원 >= 1, 추첨 방식은 선택값을 저장하고 상품 배정 알고리즘은 기존 값을 유지
 *  - 상품 등급: prizeKey는 영문·숫자·_·- 만, 중복 불가, priority/weight/quantity는 양수
 *  - 상품을 등록했다면 총 수량 >= 당첨 인원
 * 생성은 requestId(UUID)로 멱등 처리되므로, 같은 폼에서 재시도해도 중복 생성되지 않는다.
 * 배너(Cking-BE docs/domains/event/banner-api.md): 파일을 고르면 POST /api/creator/events/banner-images로 올려 key를 받고,
 * 저장할 때 `bannerImageKey`로 보낸다. 수정에서 배너를 건드리지 않으면 key를 보내지 않아 현재 배너를 유지하고, 지우면 null을 보낸다.
 */
export default function CreatorEventForm() {
  const { eventId } = useParams()
  return <EventFormLoader key={eventId ? `edit:${eventId}` : 'create'} eventId={eventId} />
}

/** 수정 대상 이벤트를 불러온 뒤 생성·수정 폼을 표시한다. */
function EventFormLoader({ eventId }) {
  const isEdit = Boolean(eventId)
  const goBack = useAppBack('/my-page')

  // 수정 모드에서는 내 이벤트 목록을 끝까지 읽어 해당 이벤트를 찾아 초기값으로 쓴다.
  const existing = useAsync(() => getAllMyCreatorEvents(), [], {
    enabled: isEdit,
    fallbackMessage: '이벤트 정보를 불러오지 못했습니다.',
  })

  const target = useMemo(
    () => (existing.data ?? []).find((item) => String(item.eventId) === String(eventId)) ?? null,
    [existing.data, eventId],
  )

  if (isEdit && existing.loading) {
    return (
      <div className="flex flex-col w-full min-h-screen pt-safe">
        <BackHeader title="이벤트 수정" onBack={goBack} />
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

  return <EventFormBody eventId={eventId} isEdit={isEdit} target={target} />
}

/** 이벤트 입력 상태를 관리하고 검증된 값을 생성·수정 API에 전달한다. */
function EventFormBody({ eventId, isEdit, target }) {
  const navigate = useNavigate()
  const goBack = useAppBack('/my-page')
  const showToast = useToast()
  // 저장하면 내 스페이스의 이벤트 탭으로 돌아간다. 스페이스를 못 찾으면 마이페이지로 보낸다.
  const mySpace = useAsync(() => getMySpace(), [])

  const [requestId] = useState(() => newRequestId())
  // ref는 따로 꺼내 둔다. 같은 객체로 ref를 넘기면 린터가 객체의 다른 값(busy 등)까지 렌더 중 ref 읽기로 본다.
  const { fileInput: bannerFileInput, ...banner } = useImageUploadPick({
    validate: validateEventBannerImage,
    upload: uploadEventBannerImage,
    failMessage: '배너를 올리지 못했어요. 다시 시도해주세요.',
    describeError: describeEventBannerError,
  })
  // 수정 중인 이벤트에 이미 연결된 배너. 방금 올린 배너는 미리보기(blob:)로, 지우기를 고르면 아무것도 보여주지 않는다.
  const savedBannerUrl = toSafeHttpUrl(target?.bannerImageUrl)
  const shownBannerUrl = banner.pendingKey === null ? null : (banner.previewUrl ?? savedBannerUrl)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)
  const [createdEventId, setCreatedEventId] = useState(null)
  const [approvalBusy, setApprovalBusy] = useState(false)
  const [approvalError, setApprovalError] = useState(null)
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  const [initialPrizes] = useState(() => {
    const prizes = (target?.prizes ?? []).map(prize => ({ ...prize }))
    const reservedKeys = new Set(prizes.map(prize => prize.prizeKey.toLowerCase()))
    if (prizes.length === 0) {
      prizes.push({ ...EMPTY_PRIZE, prizeKey: allocatePrizeKey(reservedKeys, newRequestId), displayName: '1등 상품' })
    }
    return { prizes, reservedKeys: [...reservedKeys] }
  })
  // 삭제한 상품도 예약에서 빼지 않는다. 키는 렌더나 저장이 아닌 신규 행 추가 시에만 발급한다.
  const reservedPrizeKeys = useRef(new Set(initialPrizes.reservedKeys))
  const [form, setForm] = useState(() =>
    target
      ? {
          title: target.title ?? '',
          description: target.description ?? '',
          drawMethod: target.drawMethod ?? 'WEIGHTED',
          prizeAlgorithmVersion: target.prizeAlgorithmVersion ?? null,
          winnerCount: target.winnerCount ?? 1,
          startAt: toLocalInput(target.startAt),
          endAt: toLocalInput(target.endAt),
          prizes: initialPrizes.prizes,
        }
      : {
          title: '',
          description: '',
          drawMethod: 'WEIGHTED',
          winnerCount: 1,
          prizes: initialPrizes.prizes,
          ...defaultRange(),
        },
  )

  /** 이벤트의 일반 입력 항목 하나를 갱신한다. */
  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  /** 지정한 상품 행의 입력 항목 하나를 갱신한다. */
  function updatePrize(index, key, value) {
    setForm((prev) => ({
      ...prev,
      prizes: prev.prizes.map((prize, i) => (i === index ? { ...prize, [key]: value } : prize)),
    }))
  }

  /** 고유한 상품 키와 빈 숫자 입력을 가진 상품 행을 추가한다. */
  function addPrize() {
    try {
      const prizeKey = allocatePrizeKey(reservedPrizeKeys.current, newRequestId)
      setForm((prev) => ({
        ...prev,
        prizes: [...prev.prizes, { ...EMPTY_PRIZE, prizeKey }],
      }))
    } catch (error) {
      setFormError(error.message)
    }
  }

  /** 선택한 상품 행만 폼에서 제거한다. */
  function removePrize(index) {
    setForm((prev) => ({ ...prev, prizes: prev.prizes.filter((_, i) => i !== index) }))
  }

  /** 초안만 남기거나 승인 요청을 마친 뒤 내 스페이스 이벤트 탭으로 이동한다. */
  function goToEvents() {
    navigate(mySpace.data ? spacePath(mySpace.data.slug) : '/my-page', { replace: true, state: { tab: 'events' } })
  }

  /** 즉시 승인 요청을 건너뛰고 초안을 남긴 상태로 이벤트 목록에 이동한다. */
  function finishDraft() {
    showToast('이벤트 초안을 작성했어요.')
    goToEvents()
  }

  /** 새 초안의 승인 요청을 처리하고, 응답 전에 화면을 떠났다면 이동·상태 갱신을 생략한다. */
  async function handleApprovalRequest() {
    if (approvalBusy || createdEventId === null) return
    setApprovalBusy(true)
    setApprovalError(null)
    try {
      await requestEventApproval(createdEventId)
      if (!mounted.current) return
      showToast('승인 요청을 보냈어요.')
      goToEvents()
    } catch (err) {
      if (mounted.current) setApprovalError(describeCreatorWriteError(err, '승인 요청에 실패했어요.'))
    } finally {
      if (mounted.current) setApprovalBusy(false)
    }
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
      if (!prize.displayName?.trim()) return '상품 이름을 입력해주세요.'
      if (!/^[A-Za-z0-9_-]{1,100}$/.test(prize.prizeKey ?? '')) return '상품 정보를 확인하지 못했어요. 화면을 다시 열어 주세요.'
      if (keys.has(prize.prizeKey.toLowerCase())) return '상품 식별자가 중복됐어요. 화면을 다시 열어 주세요.'
      keys.add(prize.prizeKey.toLowerCase())
      if ([prize.priority, prize.weight, prize.quantity].some(value => value == null || String(value).trim() === '')) {
        return '상품의 순위·가중치·수량을 모두 입력해주세요.'
      }
      if ([prize.priority, prize.weight, prize.quantity].some(value => !Number.isInteger(Number(value)) || Number(value) < 1)) {
        return '상품의 순위·가중치·수량은 1 이상의 정수여야 해요.'
      }
    }
    if (form.prizes.length > 0 && totalQuantity < Number(form.winnerCount)) {
      return `상품 총 수량(${totalQuantity}개)이 당첨 인원(${form.winnerCount}명)보다 적어요.`
    }
    return null
  }

  /** 검증된 입력으로 이벤트를 저장하고 신규 초안이면 승인 요청 확인 시트를 연다. */
  async function handleSubmit(event) {
    event.preventDefault()
    // 배너를 올리는 중에 저장하면 고른 배너가 빠진 채 저장되므로 업로드가 끝날 때까지 막는다.
    if (submitting || createdEventId !== null || banner.busy) return
    const message = validate()
    if (message) {
      setFormError(message)
      return
    }
    setFormError(null)
    setSubmitting(true)

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      startAt: toInstant(form.startAt),
      endAt: toInstant(form.endAt),
      winnerCount: Number(form.winnerCount),
      drawMethod: form.drawMethod,
      // PATCH는 전체 교체라 생략하면 BE가 PRIZE_WEIGHTED_V1로 되돌린다. 수정 때는 기존 값을 그대로 보낸다.
      ...(form.prizeAlgorithmVersion ? { prizeAlgorithmVersion: form.prizeAlgorithmVersion } : {}),
      prizes: form.prizes.map((prize) => ({
        prizeKey: prize.prizeKey,
        displayName: prize.displayName.trim(),
        priority: Number(prize.priority),
        weight: Number(prize.weight),
        quantity: Number(prize.quantity),
      })),
    }
    // 생성은 새로 올린 배너만 보낸다. 수정은 배너를 바꿨을 때만 보낸다(생략=유지, null=제거).
    if (isEdit ? banner.pendingKey !== undefined : typeof banner.pendingKey === 'string') {
      payload.bannerImageKey = banner.pendingKey
    }

    try {
      if (isEdit) {
        await updateCreatorEvent(eventId, payload)
        showToast('이벤트를 수정했어요.')
        goToEvents()
      } else {
        const created = await createCreatorEvent({ ...payload, requestId })
        setCreatedEventId(created.eventId)
      }
    } catch (err) {
      // 활동명을 정하기 전에는 이벤트를 만들거나 고칠 수 없다(ACTIVITY_NAME_SETUP_REQUIRED).
      // 올린 배너가 정리됐거나 쓸 수 없으면 INVALID_EVENT_BANNER_IMAGE다. 그 밖의 오류는 기존대로 보여 준다.
      setFormError(describeEventBannerError(err, '저장에 실패했습니다. 입력값을 확인해주세요.'))
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'w-full h-11 px-3.5 rounded-xl bg-surface-container text-on-surface font-body-md text-body-md placeholder:text-outline focus:bg-surface-container-lowest focus:outline-none shadow-sm transition-all'
  const labelClass = 'font-label-sm text-label-sm text-on-surface font-semibold'

  return (
    <div className="flex flex-col w-full min-h-screen pt-safe pb-32">
      <BackHeader title={isEdit ? '이벤트 수정' : '새 이벤트 작성'} onBack={goBack} />

      <form onSubmit={handleSubmit} className="pt-16 px-margin flex flex-col gap-space-md md:mx-auto md:w-full md:max-w-4xl md:px-8">
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
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={labelClass}>배너 이미지</span>
          <button
            type="button"
            onClick={banner.openPicker}
            disabled={banner.busy || submitting || createdEventId !== null}
            aria-label={shownBannerUrl ? '배너 이미지 변경' : '배너 이미지 선택'}
            className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-surface-container active:scale-[0.99] transition-transform disabled:opacity-70"
          >
            {shownBannerUrl ? (
              <img className="h-full w-full object-cover" src={shownBannerUrl} alt="배너 미리보기" />
            ) : (
              <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-on-surface-variant">
                <MaterialIcon name="add_photo_alternate" className="text-[36px]" />
                <span className="font-label-sm text-label-sm">
                  {banner.pendingKey === null ? '저장하면 배너가 지워져요' : '배너를 올려 주세요'}
                </span>
              </span>
            )}
            {banner.busy && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                <Spinner className="h-6 w-6 text-white" />
              </span>
            )}
          </button>
          <input
            ref={bannerFileInput}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={banner.handleFile}
            aria-label="배너 이미지 파일"
          />
          <div className="flex items-center gap-space-md">
            <button
              type="button"
              onClick={banner.openPicker}
              disabled={banner.busy || submitting || createdEventId !== null}
              className="font-label-md text-label-md font-semibold text-primary disabled:opacity-50"
            >
              {shownBannerUrl ? '배너 변경' : '배너 선택'}
            </button>
            {typeof banner.pendingKey === 'string' ? (
              <button
                type="button"
                // 방금 올린 배너만 버리고 원래 상태(저장된 배너 또는 배너 없음)로 돌아간다. 저장된 배너는 건드리지 않는다.
                onClick={banner.reset}
                disabled={banner.busy || submitting || createdEventId !== null}
                className="font-label-sm text-label-sm text-on-surface-variant disabled:opacity-50"
              >
                {savedBannerUrl ? '변경 취소' : '선택 취소'}
              </button>
            ) : shownBannerUrl ? (
              <button
                type="button"
                // 저장된 배너를 보여 줄 때만 지우기다. 저장할 때 배너를 떼도록 null을 보낸다.
                onClick={banner.remove}
                disabled={banner.busy || submitting || createdEventId !== null}
                className="font-label-sm text-label-sm text-on-surface-variant disabled:opacity-50"
              >
                배너 지우기
              </button>
            ) : null}
            {banner.pendingKey === null && (
              <button
                type="button"
                onClick={banner.cancelRemove}
                disabled={submitting}
                className="font-label-sm text-label-sm text-on-surface-variant disabled:opacity-50"
              >
                지우기 취소
              </button>
            )}
          </div>
          <p className="font-label-xs text-label-xs text-on-surface-variant">
            JPEG·PNG, 5MB 이하, 600×200px 이상
          </p>
          {banner.error && <p className="font-label-xs text-label-xs text-error" role="alert">{banner.error}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-space-sm">
          <div className="flex flex-col gap-1.5">
            <label className={labelClass} htmlFor="event-start">
              시작 <span className="text-primary">*</span>
            </label>
            <input
              id="event-start"
              type="datetime-local"
              className={`${inputClass} min-w-0`}
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
              className={`${inputClass} min-w-0`}
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
            <div className="flex items-center gap-1">
              <label className={labelClass} htmlFor="event-draw-method">추첨 방식</label>
              <FieldHelp label="추첨 방식">
                동일 확률: 응모권 수와 관계없이 참여자마다 같은 확률로 뽑아요.<br />
                응모권 수 비례: 이 이벤트에 응모한 응모권이 많을수록 당첨 가능성이 높아져요.
              </FieldHelp>
            </div>
            <div className="relative">
              <select
                id="event-draw-method"
                className={`${inputClass} appearance-none text-transparent opacity-70`}
                value={form.drawMethod}
                onChange={(e) => updateField('drawMethod', e.target.value)}
              >
                {Object.entries(DRAW_METHOD_LABELS).map(([value, label]) => (
                  <option key={value} value={value} className="text-on-surface">{label}</option>
                ))}
              </select>
              <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-2 right-6 flex items-center break-keep text-[12px] leading-4 text-on-surface opacity-70">
                {DRAW_METHOD_LABELS[form.drawMethod]}
              </span>
              <svg aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-on-surface opacity-70" width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="m3 4.5 3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
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
            <div key={prize.prizeKey} className="p-space-sm rounded-xl bg-surface-container-lowest flex flex-col gap-2 shadow-sm">
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
              <div className="flex flex-col gap-1.5">
                <label className={labelClass} htmlFor={`event-prize-${prize.prizeKey}-name`}>
                  상품 이름 <span className="text-primary">*</span>
                </label>
                <input
                  id={`event-prize-${prize.prizeKey}-name`}
                  className={inputClass}
                  value={prize.displayName}
                  onChange={(e) => updatePrize(index, 'displayName', e.target.value)}
                  placeholder="표시 이름"
                  aria-label={`상품 ${index + 1} 이름`}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['priority', '순위', '예: 1'],
                  ['weight', '가중치', '예: 100'],
                  ['quantity', '수량', '예: 1'],
                ].map(([key, label, placeholder]) => (
                  <div key={key} className="flex min-w-0 flex-col gap-1.5">
                    <div className="flex items-center gap-0.5">
                      <label className={labelClass} htmlFor={`event-prize-${prize.prizeKey}-${key}`}>
                        {label} <span className="text-primary">*</span>
                      </label>
                      {key === 'weight' && (
                        <FieldHelp label={`상품 ${index + 1} 가중치`} centered>
                          당첨자에게 이 상품을 배정할 상대적인 비율이에요. 예: 10과 90이면 처음 배정할 때 10%, 90%예요. 재고 소진 시 비율이 달라지며, 상품이 하나이거나 균등 배정이면 확률에 영향을 주지 않아요.
                        </FieldHelp>
                      )}
                    </div>
                    <input
                      id={`event-prize-${prize.prizeKey}-${key}`}
                      type="number"
                      min={1}
                      step={1}
                      className={`${inputClass} min-w-0`}
                      value={prize[key]}
                      onChange={(e) => updatePrize(index, key, e.target.value)}
                      placeholder={placeholder}
                      aria-label={`상품 ${index + 1} ${label}`}
                    />
                  </div>
                ))}
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

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] md:max-w-none z-40 bg-surface-glass backdrop-blur-2xl px-space-md pt-3 pb-6 shadow-[0_-8px_24px_rgba(15,23,42,0.06)]">
        <div className="mx-auto w-full max-w-2xl">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || createdEventId !== null || banner.busy}
          className="w-full h-12 rounded-xl bg-primary text-on-primary font-title-md text-title-md font-bold shadow-lg active:scale-[0.98] transition-all disabled:opacity-60"
        >
          {submitting ? '저장 중...' : banner.busy ? '배너 올리는 중...' : isEdit ? '수정 저장' : '이벤트 초안 작성'}
        </button>
        </div>
      </div>
      <ConfirmSheet
        open={createdEventId !== null}
        title="바로 승인 요청을 보내시겠습니까?"
        message={approvalError ?? '이벤트 초안을 작성했어요. 승인 요청을 보내면 심사가 시작돼요.'}
        confirmLabel="승인 요청"
        cancelLabel="나중에"
        confirmTone="primary"
        busy={approvalBusy}
        onConfirm={handleApprovalRequest}
        onClose={finishDraft}
      />
    </div>
  )
}
