import { useState } from 'react'
import BottomSheet from '../ui/BottomSheet.jsx'
import { useToast } from '../../context/useToast.js'
import { ApiError, describeError } from '../../api/client.js'
import { SLUG_ERROR_MESSAGES, changeMySpaceSlug, updateMySpace } from '../../api/creatorSpace.js'

const MAX_TEXT = 500
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
 * - 홈·프로필: PATCH /api/creator/space (소개·프로필 이미지 URL·배너 이미지 URL을 한 번에 교체)
 * - slug: PATCH /api/creator/space/slug
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
  const [slug, setSlug] = useState(space.slug ?? '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingSlug, setSavingSlug] = useState(false)
  const [slugError, setSlugError] = useState(null)

  const remainingDays = daysUntil(space.slugChangeableAt)
  const profileValid = Object.values(profile).every((value) => value.trim() && value.length <= MAX_TEXT)

  async function saveProfile() {
    setSavingProfile(true)
    try {
      const updated = await updateMySpace({
        introText: profile.introText.trim(),
        profileImageUrl: profile.profileImageUrl.trim(),
        bannerImageUrl: profile.bannerImageUrl.trim(),
      })
      onSaved(updated)
      showToast('스페이스 정보를 저장했어요.')
    } catch (error) {
      showToast(describeError(error, '스페이스 정보를 저장하지 못했어요.'), { icon: 'error' })
    } finally {
      setSavingProfile(false)
    }
  }

  async function saveSlug() {
    setSavingSlug(true)
    setSlugError(null)
    try {
      const updated = await changeMySpaceSlug(slug.trim())
      onSaved(updated)
      showToast('공유 주소를 바꿨어요.')
    } catch (error) {
      const message = error instanceof ApiError ? SLUG_ERROR_MESSAGES[error.code] : null
      setSlugError(message ?? describeError(error, '공유 주소를 바꾸지 못했어요.'))
    } finally {
      setSavingSlug(false)
    }
  }

  return (
    <div className="flex flex-col gap-space-lg pb-space-md">
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
        <label className="flex flex-col gap-1">
          <span className="font-label-xs text-label-xs text-on-surface-variant">프로필 이미지 URL</span>
          <input
            type="url"
            value={profile.profileImageUrl}
            maxLength={MAX_TEXT}
            onChange={(event) => setProfile((prev) => ({ ...prev, profileImageUrl: event.target.value }))}
            className={inputClass}
          />
        </label>
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
          disabled={!profileValid || savingProfile}
          onClick={saveProfile}
          className="w-full h-11 rounded-xl bg-primary disabled:opacity-50 text-on-primary font-label-md text-label-md font-semibold active:scale-[0.98] transition-all"
        >
          {savingProfile ? '저장하는 중...' : '저장'}
        </button>
      </section>

      <section className="flex flex-col gap-space-sm">
        <h3 className="font-label-md text-label-md font-semibold text-on-surface">공유 주소</h3>
        <label className="flex flex-col gap-1">
          <span className="font-label-xs text-label-xs text-on-surface-variant">/space/</span>
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
