import { useEffect, useRef, useState } from 'react'
import { LoadingBlock, ErrorBlock } from '../ui/States.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { useToast } from '../../context/useToast.js'
import { describeActivityNameError, getMyCreatorProfile, updateMyActivityName } from '../../api/creatorProfile.js'
import { isActivityNameLocked } from '../../utils/activityName.js'
import { NICKNAME_MAX_LENGTH, NICKNAME_RULE_HINT, normalizeNickname, validateNickname } from '../../utils/nickname.js'
import { formatDateTime } from '../../utils/format.js'
import { parseServerTime } from '../../utils/serverTime.js'

const inputClass =
  'w-full px-3 py-2.5 rounded-xl bg-surface-container text-on-surface font-body-sm text-body-sm placeholder:text-outline focus:bg-surface-container-lowest focus:outline-none shadow-sm transition-all disabled:opacity-60'

/**
 * Creator 활동명 설정·변경(Cking-BE #520, `GET`·`PUT /api/creator/profile`). 스페이스 편집 안에서 쓴다.
 * 형식은 닉네임과 같다. 최초 설정은 즉시, 이후 변경은 14일 간격이고, 예약 기간 안의 이전 활동명으로는 언제든 되돌릴 수 있다.
 *
 * @param {{ onSaved?: (activityName: string) => void }} props onSaved: 저장에 성공하면 새 활동명을 알린다(화면의 크리에이터 이름을 바꾸기 위해)
 */
export default function ActivityNameSection({ onSaved }) {
  const showToast = useToast()
  const { data: profile, loading, error, reload, setData } = useAsync(
    () => getMyCreatorProfile(),
    [],
    { fallbackMessage: '활동명을 불러오지 못했어요.' },
  )

  if (loading && !profile) return <LoadingBlock label="활동명을 불러오는 중..." />
  if (error && !profile) return <ErrorBlock message={error} onRetry={reload} />
  if (!profile) return null

  return (
    <ActivityNameForm
      // 서버 값이 바뀌면(저장 뒤) 입력 상태를 새로 시작한다.
      key={`${profile.activityName}:${profile.activityNameChangeableAt ?? ''}`}
      profile={profile}
      showToast={showToast}
      onSaved={(next) => {
        setData(next)
        onSaved?.(next.activityName)
      }}
    />
  )
}

function ActivityNameForm({ profile, showToast, onSaved }) {
  const original = profile.activityName ?? ''
  const configured = profile.activityNameConfigured !== false
  const locked = isActivityNameLocked(profile)
  const changeableAt = parseServerTime(profile.activityNameChangeableAt)
  const restorable = profile.restorableActivityName ?? null

  const [name, setName] = useState(original)
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const alive = useRef(true)
  const savingRef = useRef(false)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  const normalized = normalizeNickname(name)
  const changed = normalized !== original
  const nicknameError = !locked && (touched || changed) ? validateNickname(normalized) : null
  const canSave = !saving && !locked && changed && validateNickname(normalized) === null

  async function save(nextName) {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setFormError('')
    try {
      const next = await updateMyActivityName(nextName)
      showToast(configured ? '활동명을 바꿨어요.' : '활동명을 설정했어요.')
      onSaved(next)
    } catch (err) {
      if (alive.current) setFormError(describeActivityNameError(err))
    } finally {
      savingRef.current = false
      if (alive.current) setSaving(false)
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    setTouched(true)
    if (!canSave) return
    void save(normalized)
  }

  function handleRestore() {
    if (saving || !restorable) return
    setName(restorable)
    void save(normalizeNickname(restorable))
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-space-sm" aria-label="활동명">
      <h3 className="font-label-md text-label-md font-semibold text-on-surface">활동명</h3>
      {!configured && (
        <p className="rounded-xl bg-berry-tint px-3 py-2.5 font-label-xs text-label-xs text-berry-deep">
          아직 임시 활동명이에요. 팬에게 보이는 이름을 정해주세요.
        </p>
      )}
      <div className="flex flex-col gap-1">
        <label htmlFor="activity-name" className="font-label-xs text-label-xs text-on-surface-variant">
          스페이스와 이벤트에 보이는 크리에이터 이름
        </label>
        <input
          id="activity-name"
          data-clarity-mask="True"
          type="text"
          value={locked ? original : name}
          maxLength={NICKNAME_MAX_LENGTH}
          disabled={locked || saving}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          onChange={(event) => {
            setName(event.target.value)
            setFormError('')
          }}
          onBlur={() => setTouched(true)}
          aria-invalid={Boolean(nicknameError)}
          aria-describedby="activity-name-help"
          className={inputClass}
          placeholder="활동명을 입력해주세요"
        />
        <div id="activity-name-help" className="flex items-start justify-between gap-3">
          <p className={`font-label-xs text-label-xs ${nicknameError ? 'text-error' : 'text-outline'}`} role={nicknameError ? 'alert' : undefined}>
            {nicknameError ?? NICKNAME_RULE_HINT}
          </p>
          {!locked && <span className="shrink-0 font-label-xs text-label-xs text-outline">{normalized.length}/{NICKNAME_MAX_LENGTH}</span>}
        </div>
      </div>
      {locked && changeableAt && (
        <p className="rounded-xl bg-surface-container-low px-3 py-2.5 font-body-sm text-body-sm text-on-surface-variant">
          활동명은 {formatDateTime(changeableAt.toISOString())} 이후에 다시 바꿀 수 있어요.
        </p>
      )}
      {restorable && (
        <button
          type="button"
          onClick={handleRestore}
          disabled={saving}
          className="self-start font-label-md text-label-md font-semibold text-primary disabled:opacity-50"
        >
          이전 활동명 ‘{restorable}’으로 되돌리기
        </button>
      )}
      {formError && (
        <p className="rounded-xl bg-error-container px-3 py-2.5 font-body-sm text-body-sm text-on-error-container" role="alert">
          {formError}
        </p>
      )}
      <button
        type="submit"
        disabled={!canSave}
        className="w-full h-11 rounded-xl bg-primary disabled:opacity-50 text-on-primary font-label-md text-label-md font-semibold active:scale-[0.98] transition-all"
      >
        {saving ? '저장하는 중...' : configured ? '활동명 저장' : '활동명 설정'}
      </button>
    </form>
  )
}
