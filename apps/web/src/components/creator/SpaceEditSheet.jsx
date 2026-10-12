import { useEffect, useMemo, useRef, useState } from 'react'
import BottomSheet from '../ui/BottomSheet.jsx'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import { Spinner } from '../ui/States.jsx'
import ActivityNameSection from './ActivityNameSection.jsx'
import { useToast } from '../../context/useToast.js'
import { ApiError, describeError } from '../../api/client.js'
import {
  SLUG_ERROR_MESSAGES,
  changeMySpaceSlug,
  describeSpaceImageError,
  updateMySpace,
  uploadSpaceProfileImage,
} from '../../api/creatorSpace.js'
import { validateProfileImage } from '../../utils/imageFile.js'
import { forgetPreviousSlug, readPreviousSlug, rememberPreviousSlug, selectRestorableSlug } from '../../utils/previousSlug.js'
import { toSafeHttpUrl } from '../../utils/safeUrl.js'
import { pickFields } from '../../utils/spaceProfile.js'

const MAX_TEXT = 500
// 저장마다 화면 상태에 넘기는 필드. 겹친 저장이 서로의 결과를 옛 값으로 되돌리지 않게 자기 필드만 넘긴다.
const PROFILE_FIELDS = ['introText', 'profileImageUrl', 'bannerImageUrl']
const SLUG_FIELDS = ['slug', 'slugChangeableAt']
const DAY_MS = 24 * 60 * 60 * 1000

/** slugChangeableAt(ISO)까지 남은 일수. 이미 지났거나 없으면 0. */
function daysUntil(isoTime) {
  if (!isoTime) return 0
  const remaining = new Date(isoTime).getTime() - Date.now()
  return remaining > 0 ? Math.ceil(remaining / DAY_MS) : 0
}

const inputClass =
  'w-full px-3 py-2.5 rounded-xl bg-surface-container text-on-surface font-body-sm text-body-sm placeholder:text-outline focus:bg-surface-container-lowest focus:outline-none shadow-sm transition-all'

/**
 * Creator 본인의 Space 편집(Cking-BE docs/domains/creator/space-api.md).
 * - 활동명: GET·PUT /api/creator/profile (ActivityNameSection). 저장하면 화면의 크리에이터 이름도 바로 바뀐다.
 * - 홈·프로필: PATCH /api/creator/space (소개·프로필 이미지 URL·배너 이미지 URL을 한 번에 교체)
 *   프로필 사진은 파일을 고르면 POST /api/creator/space/profile-images로 올려 key를 받고, 저장할 때 `profileImageKey`로 보낸다.
 *   바꾸지 않으면 key를 보내지 않아 현재 사진을 유지하고, 지우면 null을 보내 기본 이미지로 돌아간다. 배너는 BE에 업로드가 없어 URL 입력이다.
 * - slug: PATCH /api/creator/space/slug
 *   BE는 버린 이전 slug를 14일 동안 본인 전용으로 예약해 14일 간격 없이 되돌릴 수 있게 하지만 이전 주소를 응답으로 주지 않아,
 *   이 브라우저에서 바꿀 때 이전 주소를 기억해 두었다가(utils/previousSlug.js) 되돌리기 버튼에 쓴다.
 *   14일 변경 제한이 있어도 본인이 버린 이전 slug로 되돌리는 것은 허용되므로, 버튼은 막지 않고 백엔드 판단을 따른다.
 */
export default function SpaceEditSheet({ open, onClose, space, onSaved }) {
  return (
    <BottomSheet open={open} onClose={onClose} eyebrow="Creator Space" title="스페이스 편집">
      {open && space && <SpaceEditForm space={space} onSaved={onSaved} />}
    </BottomSheet>
  )
}

function SpaceEditForm({ space, onSaved }) {
  const showToast = useToast()
  const [profile, setProfile] = useState({
    introText: space.introText ?? '',
    profileImageUrl: space.profileImageUrl ?? '',
    bannerImageUrl: space.bannerImageUrl ?? '',
  })
  // undefined: 사진을 바꾸지 않음 / null: 기본 이미지로 / string: 새로 올린 사진의 key
  const [pendingKey, setPendingKey] = useState(undefined)
  const [previewUrl, setPreviewUrl] = useState(null)
  // 파일을 고른 순간부터(검증·업로드 중) 켜진다. 이 동안은 저장·사진 변경을 막아 이전 선택의 결과가 나중 선택을 덮지 못하게 한다.
  const [photoBusy, setPhotoBusy] = useState(false)
  const [imageError, setImageError] = useState('')
  const photoSeq = useRef(0)
  const alive = useRef(true)
  const fileInput = useRef(null)
  const [slug, setSlug] = useState(space.slug ?? '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingSlug, setSavingSlug] = useState(false)
  const [slugError, setSlugError] = useState(null)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  // 방금 올린 사진의 미리보기 주소(blob:). 바뀌거나 화면을 떠나면 해제한다.
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const remainingDays = daysUntil(space.slugChangeableAt)
  // 프로필 이미지 URL은 입력칸이 없어도 PATCH에 필수라 현재 값을 그대로 보낸다(업로드 사진이 연결돼 있으면 BE가 무시한다).
  const profileValid = Object.values(profile).every((value) => value.trim() && value.length <= MAX_TEXT)
  // 방금 올린 사진은 미리보기(blob:) 주소로, 저장돼 있는 사진은 서버 주소가 http(s)일 때만 보여준다.
  const shownImage = pendingKey === null ? null : (previewUrl ?? toSafeHttpUrl(space.profileImageUrl))

  async function handleFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || photoBusy) return
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
      const { imageKey } = await uploadSpaceProfileImage(file)
      if (!isLatest()) return
      setPendingKey(imageKey)
      setPreviewUrl(URL.createObjectURL(file))
    } catch (error) {
      if (isLatest()) setImageError(describeSpaceImageError(error, '사진을 올리지 못했어요. 다시 시도해주세요.'))
    } finally {
      if (isLatest()) setPhotoBusy(false)
    }
  }

  function removeImage() {
    setImageError('')
    setPreviewUrl(null)
    setPendingKey(null)
  }

  async function saveProfile() {
    setSavingProfile(true)
    try {
      const updated = await updateMySpace({
        introText: profile.introText.trim(),
        profileImageUrl: profile.profileImageUrl.trim(),
        bannerImageUrl: profile.bannerImageUrl.trim(),
        profileImageKey: pendingKey,
      })
      onSaved(pickFields(updated, PROFILE_FIELDS))
      // 저장된 사진이 현재 사진이 된다. 이후 저장에는 새 주소를 보내고 사진은 다시 바꾸지 않은 상태로 둔다.
      setProfile((prev) => ({ ...prev, profileImageUrl: updated.profileImageUrl ?? prev.profileImageUrl }))
      setPendingKey(undefined)
      setPreviewUrl(null)
      showToast('스페이스 정보를 저장했어요.')
    } catch (error) {
      showToast(describeSpaceImageError(error, '스페이스 정보를 저장하지 못했어요.'), { icon: 'error' })
    } finally {
      setSavingProfile(false)
    }
  }

  // 이 브라우저에서 기억해 둔 이전 주소 중 예약 기간(14일) 안이고 지금과 다른 것. 되돌리기 버튼에 쓴다.
  // 저장소 기록을 지우면 값이 바뀌지만 space는 그대로라서, 지울 때 올리는 번호로 다시 계산한다.
  const [slugMemoryVersion, setSlugMemoryVersion] = useState(0)
  const restorableSlug = useMemo(
    () => selectRestorableSlug(readPreviousSlug(space.creatorId), space.slug),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [space.creatorId, space.slug, slugMemoryVersion],
  )

  /** 새 주소로 바꾸거나(restoring=false) 이전 주소로 되돌린다. 바꾸기 전 주소를 이전 주소로 기억한다(되돌릴 때 버린 주소도 14일 예약된다). */
  async function applySlug(nextSlug, { restoring }) {
    const before = space.slug
    setSavingSlug(true)
    setSlugError(null)
    try {
      const updated = await changeMySpaceSlug(nextSlug)
      if (before && before !== updated.slug) rememberPreviousSlug(space.creatorId, before)
      setSlug(updated.slug)
      onSaved(pickFields(updated, SLUG_FIELDS))
      showToast(restoring ? '이전 공유 주소로 되돌렸어요.' : '공유 주소를 바꿨어요.')
    } catch (error) {
      const message = error instanceof ApiError ? SLUG_ERROR_MESSAGES[error.code] : null
      setSlugError(message ?? describeError(error, restoring ? '이전 공유 주소로 되돌리지 못했어요.' : '공유 주소를 바꾸지 못했어요.'))
      // 예약 기간이 지나 다른 사람이 쓰게 된 주소라면 더는 되돌리기로 보여주지 않는다.
      if (restoring && error instanceof ApiError && error.code === 'SLUG_ALREADY_TAKEN') {
        forgetPreviousSlug(space.creatorId)
        setSlugMemoryVersion((current) => current + 1)
      }
    } finally {
      setSavingSlug(false)
    }
  }

  const saveSlug = () => applySlug(slug.trim(), { restoring: false })
  const restoreSlug = () => applySlug(restorableSlug, { restoring: true })

  return (
    <div className="flex flex-col gap-space-lg pb-space-md">
      <ActivityNameSection onSaved={(activityName) => onSaved({ creatorName: activityName })} />

      <section className="flex flex-col gap-space-sm">
        <h3 className="font-label-md text-label-md font-semibold text-on-surface">홈·프로필</h3>
        <label className="flex flex-col gap-1">
          <span className="font-label-xs text-label-xs text-on-surface-variant">소개</span>
          <textarea
            value={profile.introText}
            maxLength={MAX_TEXT}
            rows={3}
            onChange={(event) => setProfile((prev) => ({ ...prev, introText: event.target.value }))}
            className={`${inputClass} resize-none`}
          />
        </label>
        <div className="flex flex-col gap-1">
          <span className="font-label-xs text-label-xs text-on-surface-variant">프로필 사진</span>
          <div className="flex items-center gap-space-md">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={photoBusy || savingProfile}
              aria-label="프로필 사진 변경"
              className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-surface-container active:scale-95 transition-transform disabled:opacity-70"
            >
              {shownImage ? (
                <img src={shownImage} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-on-surface-variant">
                  <MaterialIcon name="person" className="text-[40px]" />
                </span>
              )}
              {photoBusy && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <Spinner className="h-6 w-6 text-white" />
                </span>
              )}
            </button>
            <input ref={fileInput} type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleFile} />
            <div className="flex flex-col items-start gap-1">
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={photoBusy || savingProfile}
                className="font-label-md text-label-md font-semibold text-primary disabled:opacity-50"
              >
                사진 변경
              </button>
              {pendingKey !== null && (
                <button
                  type="button"
                  onClick={removeImage}
                  disabled={photoBusy || savingProfile}
                  className="font-label-sm text-label-sm text-on-surface-variant disabled:opacity-50"
                >
                  기본 이미지로
                </button>
              )}
              <p className="font-label-xs text-label-xs text-on-surface-variant">
                {pendingKey === null ? '저장하면 기본 이미지로 돌아가요.' : 'JPEG·PNG, 5MB 이하, 200×200px 이상'}
              </p>
            </div>
          </div>
          {imageError && <p className="font-label-xs text-label-xs text-error" role="alert">{imageError}</p>}
        </div>
        <label className="flex flex-col gap-1">
          <span className="font-label-xs text-label-xs text-on-surface-variant">배너 이미지 URL</span>
          <input
            type="url"
            value={profile.bannerImageUrl}
            maxLength={MAX_TEXT}
            onChange={(event) => setProfile((prev) => ({ ...prev, bannerImageUrl: event.target.value }))}
            className={inputClass}
          />
        </label>
        <button
          type="button"
          disabled={!profileValid || savingProfile || photoBusy}
          onClick={saveProfile}
          className="w-full h-11 rounded-xl bg-primary disabled:opacity-50 text-on-primary font-label-md text-label-md font-semibold active:scale-[0.98] transition-all"
        >
          {savingProfile ? '저장하는 중...' : '저장'}
        </button>
      </section>

      <section className="flex flex-col gap-space-sm">
        <h3 className="font-label-md text-label-md font-semibold text-on-surface">공유 주소</h3>
        <label className="flex flex-col gap-1">
          <span className="font-label-xs text-label-xs text-on-surface-variant">/</span>
          <input
            value={slug}
            onChange={(event) => setSlug(event.target.value.toLowerCase())}
            className={inputClass}
            placeholder="iu-official"
          />
        </label>
        <p className="font-label-xs text-label-xs text-on-surface-variant leading-relaxed">
          3~30자 소문자·숫자·하이픈(-)·밑줄(_). 바꾸면 이전 주소는 열리지 않고, 이전 주소는 14일 동안 나만 다시 쓸 수 있어요.
        </p>
        {remainingDays > 0 && (
          <p className="font-label-xs text-label-xs text-primary">
            {remainingDays}일 후 새 주소로 바꿀 수 있어요. (이전 주소로 되돌리기는 지금도 가능해요)
          </p>
        )}
        {slugError && <p className="font-label-xs text-label-xs text-error">{slugError}</p>}
        {restorableSlug && (
          <button
            type="button"
            onClick={restoreSlug}
            disabled={savingSlug}
            className="self-start font-label-md text-label-md font-semibold text-primary disabled:opacity-50"
          >
            이전 주소 ‘/{restorableSlug}’로 되돌리기
          </button>
        )}
        <button
          type="button"
          disabled={!slug.trim() || slug.trim() === space.slug || savingSlug}
          onClick={saveSlug}
          className="w-full h-11 rounded-xl bg-surface-container-highest disabled:opacity-50 text-on-surface font-label-md text-label-md font-semibold active:scale-[0.98] transition-all"
        >
          {savingSlug ? '바꾸는 중...' : '공유 주소 바꾸기'}
        </button>
      </section>
    </div>
  )
}
