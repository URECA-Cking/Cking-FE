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

/** UTC Instant → timeZone 기준 wall-clock의 <input type="datetime-local"> 값(초 단위 생략). */
function toZonedInputValue(date, timeZone) {
  if (!date) return ''
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]))
  const hour = parts.hour === '24' ? '00' : parts.hour
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`
}

/**
 * timeZone 기준 wall-clock(<input type="datetime-local"> 값) → UTC Instant.
 * Intl로 "이 UTC 추정값이 timeZone에서 몇 시인지"를 되짚어 오차를 보정한다(최대 2회 반복이면
 * 실무에서 쓰는 모든 지역의 DST 전환을 포함해 수렴한다).
 */
function zonedInputValueToDate(value, timeZone) {
  const [datePart, timePart] = value.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute] = timePart.split(':').map(Number)
  const target = Date.UTC(year, month - 1, day, hour, minute)

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  let guess = target
  for (let i = 0; i < 2; i += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(guess).map((part) => [part.type, part.value]))
    const hourPart = parts.hour === '24' ? 0 : Number(parts.hour)
    const asUtcIfSameWallClock = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      hourPart,
      Number(parts.minute),
      Number(parts.second),
    )
    guess += target - asUtcIfSameWallClock
  }
  return new Date(guess)
}

/**
 * DST 전환으로 존재하지 않는 wall-clock(예: 미국 봄철 전환일의 02:00~03:00)을 입력하면
 * zonedInputValueToDate가 가장 가까운 유효한 시각으로 조용히 미끄러진다. 변환 결과를 같은
 * timeZone으로 되돌려 입력값과 글자 그대로 일치하는지 검사해 그런 입력을 걸러낸다.
 */
function isZonedInputValueValid(value, timeZone) {
  if (!value) return true
  return toZonedInputValue(zonedInputValueToDate(value, timeZone), timeZone) === value
}

/**
 * 크리에이터 일정 생성·수정(Cking-BE docs/domains/calendar/api.md).
 * - PATCH는 전체 필드 교체라서 수정 시에도 항상 모든 필드를 다시 보낸다.
 * - 시작·종료 시각 입력(datetime-local)은 사용자가 고른 timeZone 기준의 wall-clock 시각으로
 *   해석해 UTC Instant로 변환한다(zonedInputValueToDate). 시간대를 직접 고르는 UI이므로
 *   입력한 시각과 timeZone의 의미가 어긋나면 안 된다 — 브라우저 로컬 시각으로 해석하면
 *   크리에이터의 시간대와 조회자(CreatorCalendar.jsx)의 시간대가 다를 때 실제 Instant가
 *   의도와 달라진다.
 * - DST 전환으로 존재하지 않는 wall-clock(예: 미국 봄철 전환일의 02:00~03:00)은
 *   isZonedInputValueValid로 걸러 저장을 막는다 — 안 걸러내면 zonedInputValueToDate가
 *   가장 가까운 유효한 시각으로 조용히 미끄러져, 저장 후 다시 열었을 때 입력과 다른
 *   시각으로 보인다.
 * - DST 전환으로 겹치는 wall-clock(예: 미국 가을 전환일의 01:30, 같은 지역 시각이 서로 다른
 *   두 Instant를 가리킴)은 반대로 재변환 시 원래 Instant를 잃을 수 있어, resolveInstant가
 *   시각·시간대를 이번에 건드리지 않은 필드는 저장된 Instant를 그대로 돌려준다.
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
  const initialTimeZone = schedule?.timeZone ?? 'Asia/Seoul'
  const [startAt, setStartAt] = useState(() =>
    toZonedInputValue(schedule ? new Date(schedule.startAt) : null, initialTimeZone),
  )
  const [endAt, setEndAt] = useState(() => toZonedInputValue(schedule ? new Date(schedule.endAt) : null, initialTimeZone))
  const [timeZone, setTimeZone] = useState(initialTimeZone)
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

  const startAtValid = isZonedInputValueValid(startAt, timeZone)
  const endAtValid = isZonedInputValueValid(endAt, timeZone)

  const canSubmit =
    title.trim().length > 0 &&
    startAt &&
    endAt &&
    new Date(startAt) < new Date(endAt) &&
    startAtValid &&
    endAtValid &&
    !saving

  // DST 전환으로 겹치는 시각(예: 가을 전환일의 01:30)은 같은 wall-clock이 서로 다른 두 Instant를
  // 가리킬 수 있어, 바뀌지 않은 시각·시간대를 다시 변환하면 원래 Instant를 잃을 수 있다(zonedInputValueToDate는
  // 입력마다 독립적으로 추정하므로 어느 쪽이었는지 기억하지 못한다). 그래서 시각·시간대 필드를
  // 이번에 건드리지 않았으면 재변환하지 않고 저장된 Instant를 그대로 보존한다.
  function resolveInstant(currentValue, originalValue, originalInstant) {
    if (schedule && currentValue === originalValue && timeZone === initial.current.timeZone) {
      return new Date(originalInstant)
    }
    return zonedInputValueToDate(currentValue, timeZone)
  }

  async function submit() {
    setSaving(true)
    setSubmitError('')
    const fields = {
      scheduleType,
      title: title.trim(),
      description: description.trim(),
      startAt: resolveInstant(startAt, initial.current.startAt, schedule?.startAt),
      endAt: resolveInstant(endAt, initial.current.endAt, schedule?.endAt),
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
      {!startAtValid && (
        <p className="font-label-xs text-label-xs text-error">
          시작 시각은 선택한 시간대의 서머타임 전환으로 존재하지 않는 시각이에요. 다른 시각을 입력해주세요.
        </p>
      )}
      {!endAtValid && (
        <p className="font-label-xs text-label-xs text-error">
          종료 시각은 선택한 시간대의 서머타임 전환으로 존재하지 않는 시각이에요. 다른 시각을 입력해주세요.
        </p>
      )}
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
