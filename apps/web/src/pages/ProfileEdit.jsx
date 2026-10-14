import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { BackHeader } from '../components/layout/TopHeader.jsx'
import MaterialIcon from '../components/ui/MaterialIcon.jsx'
import ProfilePhoto from '../components/ui/ProfilePhoto.jsx'
import { Spinner } from '../components/ui/States.jsx'
import { useToast } from '../context/useToast.js'
import { useUser } from '../context/useUser.js'
import { describeProfileError, updateMyProfile, uploadProfileImage } from '../api/profile.js'
import { validateProfileImage } from '../utils/imageFile.js'
import {
  NICKNAME_MAX_LENGTH,
  NICKNAME_RULE_HINT,
  normalizeNickname,
  validateNickname,
} from '../utils/nickname.js'
import { formatDateTime } from '../utils/format.js'
import { toSafeHttpUrl } from '../utils/safeUrl.js'
import { parseServerTime } from '../utils/serverTime.js'

/**
 * 프로필 편집(Cking-BE #518·#519). 닉네임과 프로필 사진을 한 화면에서 고치고 한 번에 저장한다(`PUT /api/me/profile`, 전체 교체).
 *
 * - 닉네임이 없는 회원(`profileConfigured === false`)이면 설정 모드다. 저장하면 온보딩이 남았을 때 온보딩으로, 아니면 원래 가려던 화면으로 간다.
 * - 닉네임은 마지막 변경 뒤 14일 동안 바꿀 수 없다(`nicknameChangeableAt`). 이때도 사진은 언제든 바꿀 수 있고, 직전 닉네임(`restorableNickname`)으로는 되돌릴 수 있다.
 * - 사진은 고르는 즉시 올려 key를 받고, 저장할 때 key를 보낸다. 바꾸지 않으면 key를 보내지 않아 서버가 현재 사진을 유지하고, 지우면 null을 보낸다.
 */
export default function ProfileEdit() {
  const { user, applyUser } = useUser()
  const navigate = useNavigate()
  const location = useLocation()
  const showToast = useToast()

  const setup = user?.profileConfigured === false
  const from = location.state?.from ?? (setup ? '/' : '/my-page')
  const originalNickname = user?.nickname ?? ''

  // 서버 시각은 UTC다. 시간대가 없는 값도 현지 시간으로 어긋나지 않게 UTC로 읽는다.
  const changeableAt = parseServerTime(user?.nicknameChangeableAt)
  const nicknameLocked = !setup && changeableAt !== null && Date.now() < changeableAt.getTime()
  const restorable = user?.restorableNickname ?? null

  const [nickname, setNickname] = useState(originalNickname)
  const [touched, setTouched] = useState(false)
  // undefined: 사진을 바꾸지 않음 / null: 기본 이미지로 / string: 새로 올린 사진의 key
  const [pendingKey, setPendingKey] = useState(undefined)
  // 방금 올린 사진의 미리보기 주소(blob:). 바뀌거나 화면을 떠나면 해제한다.
  const [previewUrl, setPreviewUrl] = useState(null)
  // 파일을 고른 순간부터(검증·업로드 중) 켜진다. 이 동안은 저장·사진 변경·삭제를 막아 이전 선택의 결과가 나중 선택을 덮지 못하게 한다.
  const [photoBusy, setPhotoBusy] = useState(false)
  // 사진 선택 요청 번호. 가장 최근 선택의 결과만 반영한다.
  const photoSeq = useRef(0)
  const [imageError, setImageError] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const fileInput = useRef(null)
  const alive = useRef(true)
  const savingRef = useRef(false)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const normalized = normalizeNickname(nickname)
  const nicknameChanged = normalized !== originalNickname
  const nicknameError = !nicknameLocked && (touched || nicknameChanged) ? validateNickname(normalized) : null
  const imageChanged = pendingKey !== undefined
  const dirty = nicknameChanged || imageChanged
  // 방금 올린 사진은 미리보기(blob:) 주소로, 저장돼 있는 사진은 서버 주소가 http(s)일 때만 보여준다.
  const shownImage = pendingKey === null ? null : (previewUrl ?? toSafeHttpUrl(user?.profileImageUrl))
  // 오류 문구는 입력을 건드린 뒤에만 보이지만, 저장 가능 여부는 닉네임이 규칙을 지키는지로 항상 따진다(사진만 고른 설정 모드 방지).
  const nicknameInvalid = !nicknameLocked && validateNickname(normalized) !== null
  const canSave = !saving && !photoBusy && dirty && !nicknameInvalid

  async function handleFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (photoBusy) return
    const seq = ++photoSeq.current
    const isLatest = () => alive.current && seq === photoSeq.current
    setImageError('')
    setPhotoBusy(true)
    try {
      const reason = await validateProfileImage(file)
      if (!isLatest()) return
      if (reason) {
        setImageError(reason)
        return
      }
      const { imageKey } = await uploadProfileImage(file)
      if (!isLatest()) return
      setPendingKey(imageKey)
      setPreviewUrl(URL.createObjectURL(file))
    } catch (error) {
      if (isLatest()) setImageError(describeProfileError(error, '사진을 올리지 못했어요. 다시 시도해주세요.'))
    } finally {
      if (isLatest()) setPhotoBusy(false)
    }
  }

  function removeImage() {
    setImageError('')
    setPreviewUrl(null)
    setPendingKey(null)
  }

  async function save(nextNickname) {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setFormError('')
    try {
      const me = await updateMyProfile({ nickname: nextNickname, profileImageKey: pendingKey })
      // 저장이 끝나기 전에 화면을 떠났어도 서버에는 반영됐으므로 사용자 정보는 항상 갱신한다.
      applyUser(me)
      if (!alive.current) return
      showToast(setup ? '프로필을 설정했어요.' : '프로필을 저장했어요.')
      goNext(me)
    } catch (error) {
      if (alive.current) setFormError(describeProfileError(error))
    } finally {
      savingRef.current = false
      if (alive.current) setSaving(false)
    }
  }

  function goNext(me) {
    // 설정 모드: 신규 가입자는 온보딩이 남아 있으므로 먼저 보낸다. 그렇지 않으면 원래 가려던 화면으로 간다.
    if (setup && me?.onboardingCompleted === false) navigate('/onboarding', { replace: true, state: { from } })
    else navigate(from, { replace: true })
  }

  function handleSubmit(event) {
    event.preventDefault()
    setTouched(true)
    if (!canSave) return
    save(nicknameLocked ? originalNickname : normalized)
  }

  function handleRestore() {
    if (saving || photoBusy || !restorable) return
    setNickname(restorable)
    save(restorable)
  }

  function handleBack() {
    // 저장·사진 업로드 중에 나가면 결과를 화면에 반영하지 못한다. 끝날 때까지 기다리게 한다.
    if (saving || photoBusy) return
    if (dirty && !window.confirm('수정한 내용이 사라져요. 나갈까요?')) return
    const canGoBack = (window.history.state?.idx ?? 0) > 0
    if (canGoBack) navigate(-1)
    else navigate(from, { replace: true })
  }

  if (!user) return null

  return (
    <div className="flex min-h-screen w-full flex-col pb-32 pt-safe">
      {/* BackHeader의 기본 오른쪽 영역(공유·마이페이지)은 이 화면에 맞지 않아 빈 자리로 대신한다. */}
      <BackHeader
        title={setup ? '프로필 설정' : '프로필 편집'}
        onBack={handleBack}
        right={<span className="h-11 w-11 shrink-0" aria-hidden="true" />}
      />
      <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-[480px] flex-col gap-space-lg px-margin pt-[4.5rem] md:max-w-xl">
        {setup && (
          // bg-berry-tint는 테마와 무관한 연한 분홍이라 글자색도 고정색(berry-deep)을 써야 다크 모드에서 읽힌다.
          <div className="flex items-start gap-3 rounded-2xl bg-berry-tint border border-border-rose p-space-md">
            <MaterialIcon name="waving_hand" className="mt-0.5 text-[22px] text-primary" />
            <div className="flex flex-col gap-0.5">
              <p className="font-label-md text-label-md font-bold text-berry-deep">닉네임을 정해주세요</p>
              <p className="font-body-sm text-body-sm text-berry-deep/80">
                댓글 남기기, 이벤트 응모, 크리에이터 신청은 닉네임을 정한 뒤에 할 수 있어요.
              </p>
            </div>
          </div>
        )}

        <section className="flex flex-col items-center gap-3" aria-label="프로필 사진">
          {/* 배지가 원형 사진 영역(overflow-hidden)에 잘리지 않도록 사진과 배지를 한 래퍼 안에 나란히 둔다. */}
          <div className="relative h-28 w-28">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={photoBusy || saving}
              aria-label="프로필 사진 변경"
              className="h-full w-full overflow-hidden rounded-full bg-surface-container active:scale-95 transition-transform disabled:opacity-70"
            >
              <ProfilePhoto src={shownImage} className="h-full w-full" iconClassName="text-[56px]" />
              {photoBusy && (
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
                  <Spinner className="h-7 w-7 text-white" />
                </span>
              )}
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              onClick={() => fileInput.current?.click()}
              disabled={photoBusy || saving}
              className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-surface bg-primary text-on-primary shadow-md active:scale-95 transition-transform disabled:opacity-70"
            >
              <MaterialIcon name="photo_camera" className="text-[18px]" />
            </button>
          </div>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleFile} />
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={photoBusy || saving}
              className="font-label-md text-label-md font-semibold text-primary disabled:opacity-50"
            >
              사진 변경
            </button>
            {shownImage && (
              <button
                type="button"
                onClick={removeImage}
                disabled={photoBusy || saving}
                className="font-label-md text-label-md text-on-surface-variant disabled:opacity-50"
              >
                사진 삭제
              </button>
            )}
          </div>
          {imageError && <p className="text-center font-label-xs text-label-xs text-error" role="alert">{imageError}</p>}
        </section>

        <section className="flex flex-col gap-2" aria-label="닉네임">
          <label htmlFor="nickname" className="font-label-md text-label-md font-semibold text-on-surface">닉네임</label>
          <input
            id="nickname"
            type="text"
            value={nicknameLocked ? originalNickname : nickname}
            maxLength={NICKNAME_MAX_LENGTH}
            disabled={nicknameLocked || saving}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            onChange={(event) => { setNickname(event.target.value); setFormError('') }}
            onBlur={() => setTouched(true)}
            aria-invalid={Boolean(nicknameError)}
            aria-describedby="nickname-help"
            className="w-full rounded-xl bg-surface-container px-3 py-3 font-body-md text-body-md text-on-surface shadow-sm placeholder:text-outline focus:bg-surface-container-lowest focus:outline-none disabled:opacity-60"
            placeholder="닉네임을 입력해주세요"
          />
          <div id="nickname-help" className="flex items-start justify-between gap-3">
            <p className={`font-label-xs text-label-xs ${nicknameError ? 'text-error' : 'text-outline'}`} role={nicknameError ? 'alert' : undefined}>
              {nicknameError ?? NICKNAME_RULE_HINT}
            </p>
            {!nicknameLocked && (
              <span className="shrink-0 font-label-xs text-label-xs text-outline">{normalized.length}/{NICKNAME_MAX_LENGTH}</span>
            )}
          </div>
          {nicknameLocked && (
            <p className="rounded-xl bg-surface-container-low px-3 py-2.5 font-body-sm text-body-sm text-on-surface-variant">
              닉네임은 {formatDateTime(changeableAt.toISOString())} 이후에 다시 바꿀 수 있어요. 사진은 언제든 변경할 수 있어요.
            </p>
          )}
          {restorable && (
            <button
              type="button"
              onClick={handleRestore}
              disabled={saving || photoBusy}
              className="flex items-center gap-1.5 self-start font-label-md text-label-md font-semibold text-primary disabled:opacity-50"
            >
              <MaterialIcon name="undo" className="text-[18px]" />
              이전 닉네임 ‘{restorable}’으로 되돌리기
            </button>
          )}
        </section>

        {formError && (
          <p className="rounded-xl bg-error-container px-3 py-2.5 font-body-sm text-body-sm text-on-error-container" role="alert">
            {formError}
          </p>
        )}

        <div className="flex flex-col gap-2">
          <button
            type="submit"
            disabled={!canSave}
            className="w-full rounded-xl bg-primary py-3.5 font-label-md text-label-md font-semibold text-on-primary transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? '저장하는 중...' : setup ? '시작하기' : '저장'}
          </button>
          {setup && (
            <button
              type="button"
              onClick={() => goNext(user)}
              disabled={saving || photoBusy}
              className="py-2 font-label-md text-label-md text-on-surface-variant disabled:opacity-50"
            >
              나중에 할게요
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
