import { useEffect, useRef, useState } from 'react'
import BottomSheet from '../ui/BottomSheet.jsx'
import { describeError } from '../../api/client.js'
import { CALENDAR_ERROR_MESSAGES, SCHEDULE_TYPE_META, createSchedule, updateSchedule } from '../../api/calendar.js'

const inputClass =
  'w-full px-3 py-2.5 rounded-xl bg-surface-container text-on-surface font-body-sm text-body-sm placeholder:text-outline focus:bg-surface-container-lowest focus:outline-none shadow-sm transition-all'

const SCHEDULE_TYPE_OPTIONS = Object.entries(SCHEDULE_TYPE_META).map(([value, meta]) => ({
  value,
  label: meta.label,
}))

// IANA Time Zone Database 지역명만 허용된다(Cking-BE ScheduleTimeZones, 자유 입력 금지).
// 자주 쓰는 지역만 추린 프리셋이고, 필요하면 더 추가한다.
const TIME_ZONE_OPTIONS = [
  { value: 'Asia/Seoul', label: '서울 (KST)' },
  { value: 'Asia/Tokyo', label: '도쿄 (JST)' },
  { value: 'Asia/Shanghai', label: '상하이 (CST)' },
  { value: 'Asia/Hong_Kong', label: '홍콩 (HKT)' },
  { value: 'America/Los_Angeles', label: '로스앤젤레스 (PT)' },
  { value: 'America/New_York', label: '뉴욕 (ET)' },
  { value: 'Europe/London', label: '런던 (GMT/BST)' },
  { value: 'UTC', label: 'UTC' },
]

function describeCalendarError(error, fallback) {
  if (error?.code && CALENDAR_ERROR_MESSAGES[error.code]) return CALENDAR_ERROR_MESSAGES[error.code]
  return describeError(error, fallback)
}

/** Date → <input type="datetime-local"> 값(초 단위 생략). */
function toLocalInputValue(date) {
  if (!date) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * 크리에이터 일정 생성·수정(Cking-BE docs/domains/calendar/api.md).
 * - PATCH는 전체 필드 교체라서 수정 시에도 항상 모든 필드를 다시 보낸다.
 * - 시작·종료 시각 입력(datetime-local)은 "브라우저 로컬 시각"으로 해석해 UTC로 변환한다.
 *   timeZone 필드는 표시용 메타데이터일 뿐 이 변환에 쓰지 않는다 — 공개 캘린더 화면도 조회자의
 *   로컬 시각으로 보여주므로(CreatorCalendar.jsx) 등록 쪽도 같은 기준으로 맞춘 것이다.
 */
export default function ScheduleEditorSheet({ open, onClose, schedule, onSaved }) {
  const closeGuard = useRef(() => true)
  const registerGuard = (guard) => {
    closeGuard.current = guard
  }
  const requestClose = () => {
    if (closeGuard.current()) onClose()
  }
  return (
    <BottomSheet
      open={open}
      onClose={requestClose}
      eyebrow="Creator Calendar"
      title={schedule ? '일정 수정' : '일정 등록'}
    >
      {open && (
        <ScheduleEditorForm schedule={schedule} onClose={onClose} onSaved={onSaved} registerGuard={registerGuard} />
      )}
    </BottomSheet>
  )
}

function ScheduleEditorForm({ schedule, onClose, onSaved, registerGuard }) {
  const [scheduleType, setScheduleType] = useState(schedule?.scheduleType ?? 'FAN_SIGN')
  const [title, setTitle] = useState(schedule?.title ?? '')
  const [description, setDescription] = useState(schedule?.description ?? '')
  const [startAt, setStartAt] = useState(() => toLocalInputValue(schedule ? new Date(schedule.startAt) : null))
  const [endAt, setEndAt] = useState(() => toLocalInputValue(schedule ? new Date(schedule.endAt) : null))
  const [timeZone, setTimeZone] = useState(schedule?.timeZone ?? 'Asia/Seoul')
  const [location, setLocation] = useState(schedule?.location ?? '')
  const [imageUrl, setImageUrl] = useState(schedule?.imageUrl ?? '')
  const [externalUrl, setExternalUrl] = useState(schedule?.externalUrl ?? '')
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const snapshot = { scheduleType, title, description, startAt, endAt, timeZone, location, imageUrl, externalUrl }
  const initial = useRef(snapshot)
  const dirty = JSON.stringify(initial.current) !== JSON.stringify(snapshot)

  useEffect(() => {
    registerGuard(() => {
      if (saving) return false
      return !dirty || window.confirm('작성 중인 내용이 사라져요. 닫을까요?')
    })
    return () => registerGuard(() => true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerGuard, saving, dirty])

  const canSubmit =
    title.trim().length > 0 && startAt && endAt && new Date(startAt) < new Date(endAt) && !saving

  async function submit() {
    setSaving(true)
    setSubmitError('')
    const fields = {
      scheduleType,
      title: title.trim(),
      description: description.trim(),
      startAt: new Date(startAt),
      endAt: new Date(endAt),
      timeZone,
      location: location.trim(),
      imageUrl: imageUrl.trim(),
      externalUrl: externalUrl.trim(),
    }
    try {
      const saved = schedule ? await updateSchedule(schedule.scheduleId, fields) : await createSchedule(fields)
      onSaved(saved)
      onClose()
    } catch (error) {
      setSubmitError(describeCalendarError(error, '일정을 저장하지 못했어요.'))
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-space-md pb-space-md">
      <label className="flex flex-col gap-1">
        <span className="font-label-xs text-label-xs text-on-surface-variant">일정 종류</span>
        <select value={scheduleType} onChange={(event) => setScheduleType(event.target.value)} className={inputClass}>
          {SCHEDULE_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-label-xs text-label-xs text-on-surface-variant">제목</span>
        <input
          type="text"
          value={title}
          maxLength={100}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="예: 가을 팬사인회"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-label-xs text-label-xs text-on-surface-variant">설명 (선택)</span>
        <textarea
          value={description}
          maxLength={1000}
          rows={3}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="팬들에게 전할 안내를 적어주세요."
          className={`${inputClass} resize-none`}
        />
      </label>

      <div className="grid grid-cols-2 gap-space-sm">
        <label className="flex flex-col gap-1">
          <span className="font-label-xs text-label-xs text-on-surface-variant">시작</span>
          <input
            type="datetime-local"
            value={startAt}
            onChange={(event) => setStartAt(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label-xs text-label-xs text-on-surface-variant">종료</span>
          <input
            type="datetime-local"
            value={endAt}
            onChange={(event) => setEndAt(event.target.value)}
            className={inputClass}
          />
        </label>
      </div>
      {startAt && endAt && new Date(startAt) >= new Date(endAt) && (
        <p className="font-label-xs text-label-xs text-error">종료 시각은 시작 시각보다 늦어야 해요.</p>
      )}

      <label className="flex flex-col gap-1">
        <span className="font-label-xs text-label-xs text-on-surface-variant">시간대</span>
        <select value={timeZone} onChange={(event) => setTimeZone(event.target.value)} className={inputClass}>
          {TIME_ZONE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-label-xs text-label-xs text-on-surface-variant">장소 (선택)</span>
        <input
          type="text"
          value={location}
          maxLength={200}
          onChange={(event) => setLocation(event.target.value)}
          placeholder="예: 서울 성수동"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-label-xs text-label-xs text-on-surface-variant">이미지 URL (선택)</span>
        <input
          type="text"
          value={imageUrl}
          maxLength={500}
          onChange={(event) => setImageUrl(event.target.value)}
          placeholder="https://..."
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-label-xs text-label-xs text-on-surface-variant">외부 링크 (선택)</span>
        <input
          type="text"
          value={externalUrl}
          maxLength={500}
          onChange={(event) => setExternalUrl(event.target.value)}
          placeholder="https://..."
          className={inputClass}
        />
      </label>

      {submitError && (
        <p className="font-label-xs text-label-xs text-error" role="alert">
          {submitError}
        </p>
      )}
      <button
        type="button"
        disabled={!canSubmit}
        onClick={submit}
        className="h-11 w-full rounded-xl bg-primary font-label-md text-label-md font-semibold text-on-primary transition-all active:scale-[0.98] disabled:opacity-50"
      >
        {saving ? '저장하는 중...' : schedule ? '수정 저장' : '일정 등록'}
      </button>
    </div>
  )
}
