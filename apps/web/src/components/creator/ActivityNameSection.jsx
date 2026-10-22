import { useEffect, useRef, useState } from 'react'
import { LoadingBlock, ErrorBlock } from '../ui/States.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { describeActivityNameError, getMyCreatorProfile, updateMyActivityName } from '../../api/creatorProfile.js'
import { isActivityNameLocked } from '../../utils/activityName.js'
import { NICKNAME_MAX_LENGTH, NICKNAME_RULE_HINT, normalizeNickname, validateNickname } from '../../utils/nickname.js'
import { parseServerTime } from '../../utils/serverTime.js'

const DAY_MS = 24 * 60 * 60 * 1000

const inputClass =
  'w-full px-3 py-2.5 rounded-xl bg-surface-container text-on-surface font-body-sm text-body-sm placeholder:text-outline focus:bg-surface-container-lowest focus:outline-none shadow-sm transition-all disabled:opacity-60'

/**
 * Creator 활동명 설정·변경(Cking-BE #520, `GET`·`PUT /api/creator/profile`). 스페이스 편집 시트 안에서 쓴다.
 * 형식은 닉네임과 같다. 최초 설정은 즉시, 이후 변경은 14일 간격이고, 예약 기간 안의 이전 활동명으로는 언제든 되돌릴 수 있다.
 *
 * 저장 버튼은 따로 두지 않는다. 시트의 저장 버튼 하나가 저장하도록, 입력이 바뀔 때마다
 * { dirty, valid, firstSetup, restoring, save }를 onChange로 알린다. save()는 저장해 성공 여부(boolean)를 돌려준다(토스트는 시트가 띄운다).
 * "이전 활동명으로 되돌리기"도 바로 저장하지 않고 입력칸에 이전 활동명을 채운다. 14일 잠금 중에도 되돌리기는 저장할 수 있다.
 *
 * @param {{ onSaved?: (activityName: string) => void, onChange: (state: object|null) => void, disabled?: boolean }} props
 *   onSaved: 저장에 성공하면 새 활동명을 알린다(화면의 크리에이터 이름을 바꾸기 위해). disabled: 시트가 저장 중일 때 입력을 막는다.
 */
export default function ActivityNameSection({ onSaved, onChange, disabled = false }) {
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
      onChange={onChange}
      disabled={disabled}
      onSaved={(next) => {
        setData(next)
        onSaved?.(next.activityName)
      }}
    />
  )
}

function ActivityNameForm({ profile, onSaved, onChange, disabled }) {
  const original = profile.activityName ?? ''
  const configured = profile.activityNameConfigured !== false
  const locked = isActivityNameLocked(profile)
  const changeableAt = parseServerTime(profile.activityNameChangeableAt)
  // 공유 주소 칸처럼 남은 일수로 안내한다. 이미 지났거나 없으면 0이다.
  const remainingDays = changeableAt ? Math.max(0, Math.ceil((changeableAt.getTime() - Date.now()) / DAY_MS)) : 0
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
  // 이전 활동명으로 되돌리려는 입력. 14일 잠금 중에도 BE가 허용하고, 이미 쓰던 이름이라 형식 검사를 다시 하지 않는다.
  const restoring = Boolean(restorable) && changed && normalized === normalizeNickname(restorable)
  const nicknameError = !locked && !restoring && (touched || changed) ? validateNickname(normalized) : null
  const valid = restoring || validateNickname(normalized) === null

  /** 저장해 성공 여부를 돌려준다. 토스트는 시트가 저장 결과를 모아 한 번 띄운다. */
  async function save(nextName) {
    if (savingRef.current) return false
    savingRef.current = true
    setSaving(true)
    setFormError('')
    try {
      onSaved(await updateMyActivityName(nextName))
      return true
    } catch (err) {
      if (alive.current) setFormError(describeActivityNameError(err))
      return false
    } finally {
      savingRef.current = false
      if (alive.current) setSaving(false)
    }
  }

  // 시트의 저장 버튼이 쓸 현재 상태. 잠겨 있으면 입력이 막혀 있어 되돌리기만 바뀐 것으로 본다.
  useEffect(() => {
    onChange({
      dirty: changed && (!locked || restoring),
      valid,
      firstSetup: !configured,
      restoring,
      save: () => {
        setTouched(true)
        return save(normalized)
      },
    })
    // save는 렌더마다 새로 만들어지지만, 알릴 값이 바뀔 때만 다시 알리면 된다(save는 그때의 normalized를 쓴다).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onChange, locked, changed, restoring, valid, configured, normalized])
  // 화면에서 빠지면(시트 닫힘 등) 바뀐 것이 없다고 알린다.
  useEffect(() => () => onChange(null), [onChange])

  return (
    // 입력칸에서 Enter를 눌러도 활동명만 따로 저장하지 않는다. 저장은 시트의 저장 버튼 하나로 한다.
    <form onSubmit={(event) => { event.preventDefault(); setTouched(true) }} className="flex flex-col gap-space-sm" aria-label="활동명">
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
          value={locked && !restoring ? original : name}
          maxLength={NICKNAME_MAX_LENGTH}
          disabled={locked || saving || disabled}
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
      {/* 잠금 안내·오류·되돌리기는 공유 주소 칸과 같은 모양·순서로 보여 준다. */}
      {locked && remainingDays > 0 && (
        <p className="font-label-xs text-label-xs text-primary">
          {remainingDays}일 후 새 활동명으로 바꿀 수 있어요. (이전 활동명으로 되돌리기는 지금도 가능해요)
        </p>
      )}
      {formError && <p className="font-label-xs text-label-xs text-error" role="alert">{formError}</p>}
      {restorable && (
        <button
          type="button"
          // 바로 저장하지 않고 입력칸만 바꾼다. 저장은 시트의 저장 버튼으로 하고, 다시 누르면 원래 활동명으로 돌아간다.
          onClick={() => {
            setName(restoring ? original : restorable)
            setFormError('')
          }}
          disabled={saving || disabled}
          className="self-start font-label-sm text-label-sm font-semibold text-primary disabled:opacity-50"
        >
          {restoring ? '되돌리기 취소' : `이전 활동명 ‘${restorable}’으로 되돌리기`}
        </button>
      )}
    </form>
  )
}
