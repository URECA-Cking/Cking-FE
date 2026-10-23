import { useEffect, useMemo, useState } from 'react'
import BottomSheet from '../ui/BottomSheet.jsx'
import ConfirmSheet from '../ui/ConfirmSheet.jsx'
import ProfilePhoto from '../ui/ProfilePhoto.jsx'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import { Spinner } from '../ui/States.jsx'
import ActivityNameSection from './ActivityNameSection.jsx'
import CreatorBanner from './CreatorBanner.jsx'
import { useToast } from '../../context/useToast.js'
import { CLOSE_ALLOW, CLOSE_BLOCK, CLOSE_CONFIRM, useCloseGuard } from '../../hooks/useCloseGuard.js'
import { useImageUploadPick } from '../../hooks/useImageUploadPick.js'
import { ApiError, describeError } from '../../api/client.js'
import {
  SLUG_ERROR_MESSAGES,
  changeMySpaceSlug,
  describeSpaceImageError,
  updateMySpace,
  uploadSpaceBannerImage,
  uploadSpaceProfileImage,
} from '../../api/creatorSpace.js'
import { validateBannerImage, validateProfileImage } from '../../utils/imageFile.js'
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

/** 스페이스 이미지(프로필 사진·배너) 한 종류의 선택·업로드 상태. 지우기(null)는 스페이스 기본 이미지로 돌아간다. */
function useSpaceImagePick(options) {
  return useImageUploadPick({ ...options, describeError: describeSpaceImageError })
}

/**
 * Creator 본인의 Space 편집(Cking-BE docs/domains/creator/space-api.md).
 * 저장 버튼은 시트 아래에 하나만 두고, 바뀐 항목의 API만 활동명 → 홈·프로필 → slug 순서로 호출한다.
 * 활동명·slug는 바꾸면 14일 동안 다시 바꿀 수 없어 저장 전에 확인 시트를 띄운다(활동명 최초 설정은 제외).
 * 일부만 실패하면 성공한 항목은 반영하고 실패한 칸에 오류를 남긴다. 이전 활동명·주소로 되돌리기도 입력칸만 채우고 같은 저장 버튼으로 저장한다.
 * 저장 버튼은 시트 내용의 맨 끝(공유 주소 아래)에 있다.
 * - 활동명: GET·PUT /api/creator/profile (ActivityNameSection). 저장하면 화면의 크리에이터 이름도 바로 바뀐다.
 * - 홈·프로필: PATCH /api/creator/space (소개·프로필 이미지 URL·배너 이미지 URL을 한 번에 교체)
 *   프로필 사진은 파일을 고르면 POST /api/creator/space/profile-images로 올려 key를 받고, 저장할 때 `profileImageKey`로 보낸다.
 *   바꾸지 않으면 key를 보내지 않아 현재 사진을 유지하고, 지우면 null을 보내 기본 이미지로 돌아간다.
 *   배너도 같다: 파일을 고르면 POST /api/creator/space/banner-images로 올려 key를 받고, 저장할 때 `bannerImageKey`로 보낸다.
 *   배너 URL은 PATCH에 필수라 입력칸 없이 현재 값을 그대로 보내며, 업로드한 배너가 연결돼 있으면 BE가 무시한다.
 * - slug: PATCH /api/creator/space/slug
 *   BE는 버린 이전 slug를 14일 동안 본인 전용으로 예약해 14일 간격 없이 되돌릴 수 있게 하지만 이전 주소를 응답으로 주지 않아,
 *   이 브라우저에서 바꿀 때 이전 주소를 기억해 두었다가(utils/previousSlug.js) 되돌리기 버튼에 쓴다.
 *   14일 변경 제한이 있어도 본인이 버린 이전 slug로 되돌리는 것은 허용되므로, 버튼은 막지 않고 백엔드 판단을 따른다.
 */
export default function SpaceEditSheet({ open, onClose, space, onSaved, closeOnBack = false }) {
  // 폼이 "지금 닫아도 되는지"(저장 중이면 막고, 저장하지 않은 변경이 있으면 확인 시트)를 등록한다.
  const { registerGuard, requestClose, confirmSheetProps } = useCloseGuard(open, onClose)
  // closeOnBack: 뒤로가기도 같은 가드를 거치게 한다. 시트를 닫을 때 부모가 navigate로 history를 바꾸는 경우에는
  // 시트가 쌓은 항목과 어긋나므로 켜지 않는다.
  return (
    <>
      <BottomSheet open={open} onClose={requestClose} closeOnBack={closeOnBack} eyebrow="Creator Space" title="스페이스 편집">
        {open && space && <SpaceEditForm space={space} onSaved={onSaved} registerGuard={registerGuard} />}
      </BottomSheet>
      <ConfirmSheet {...confirmSheetProps} closeOnBack={closeOnBack} />
    </>
  )
}

/** 열린 스페이스 편집 시트의 프로필 사진·소개·주소 입력과 저장 상태를 관리한다. */
function SpaceEditForm({ space, onSaved, registerGuard }) {
  const showToast = useToast()
  const [profile, setProfile] = useState({
    introText: space.introText ?? '',
    profileImageUrl: space.profileImageUrl ?? '',
    bannerImageUrl: space.bannerImageUrl ?? '',
  })
  const photo = useSpaceImagePick({
    validate: validateProfileImage,
    upload: uploadSpaceProfileImage,
    failMessage: '사진을 올리지 못했어요. 다시 시도해주세요.',
  })
  const banner = useSpaceImagePick({
    validate: validateBannerImage,
    upload: uploadSpaceBannerImage,
    failMessage: '배너를 올리지 못했어요. 다시 시도해주세요.',
  })
  const [slug, setSlug] = useState(space.slug ?? '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingSlug, setSavingSlug] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmingSave, setConfirmingSave] = useState(false)
  const [slugError, setSlugError] = useState(null)
  const [profileError, setProfileError] = useState(null)
  // 활동명 입력 상태({ dirty, valid, firstSetup, save }). 불러오기 전이거나 화면에서 빠지면 null이다.
  const [activityName, setActivityName] = useState(null)

  const remainingDays = daysUntil(space.slugChangeableAt)
  // 공유 주소를 바꾼 지 14일이 안 지났다. 새 주소로는 못 바꾸고 이전 주소로 되돌리기만 된다(최종 판단은 BE).
  const slugLocked = remainingDays > 0
  // 소개만 필수다. 프로필 이미지·배너 URL은 입력칸이 없고, 승인 때 만든 스페이스는 이미지가 없을 수 있다(Cking-BE #754).
  const profileValid = Boolean(profile.introText.trim()) && Object.values(profile).every((value) => value.length <= MAX_TEXT)
  // 방금 올린 사진은 미리보기(blob:) 주소로, 저장돼 있는 사진은 서버 주소가 http(s)일 때만 보여준다.
  const shownImage = photo.pendingKey === null ? null : (photo.previewUrl ?? toSafeHttpUrl(space.profileImageUrl))
  const imageBusy = photo.busy || banner.busy

  // 항목별로 바뀌었는지 본다. 저장 버튼은 바뀐 항목만 저장한다. 소개는 저장할 때 앞뒤 공백을 지워 보내므로 같은 기준(trim)으로 비교한다.
  const profileDirty = profile.introText.trim() !== (space.introText ?? '').trim()
    || photo.pendingKey !== undefined || banner.pendingKey !== undefined
  const slugDirty = slug.trim() !== (space.slug ?? '')
  const nameDirty = Boolean(activityName?.dirty)
  const busy = saving || savingProfile || savingSlug
  const canSave = (profileDirty || slugDirty || nameDirty) && !busy && !imageBusy
    && (!profileDirty || profileValid) && (!slugDirty || Boolean(slug.trim())) && (!nameDirty || activityName.valid)

  // 저장하지 않은 변경(올리는 중인 이미지 포함)이 있으면 닫을 때 확인을 거친다. 저장하면 space가 갱신돼 다시 같아진다.
  const dirty = profileDirty || photo.busy || banner.busy || slugDirty || nameDirty
  // 사진·배너를 새로 고르거나 지우면 이전 저장 실패 문구를 지운다(소개는 입력할 때 지운다). 실패한 그대로면 문구가 남는다.
  useEffect(() => { setProfileError(null) }, [photo.pendingKey, banner.pendingKey])
  useEffect(() => {
    registerGuard(() => {
      if (busy) return CLOSE_BLOCK
      return dirty ? CLOSE_CONFIRM : CLOSE_ALLOW
    })
    return () => registerGuard(() => CLOSE_ALLOW)
  }, [registerGuard, busy, dirty])

  /** 소개·프로필 사진·배너를 저장하고 성공 여부를 돌려준다. 토스트는 saveAll이 한 번만 띄운다. */
  async function saveProfile() {
    // 응답을 기다리는 동안 소개를 더 고칠 수 있어, 응답 값은 요청 때와 같은 입력일 때만 입력칸에 반영한다.
    const sentIntro = profile.introText
    setSavingProfile(true)
    setProfileError(null)
    try {
      const updated = await updateMySpace({
        introText: profile.introText.trim(),
        profileImageUrl: profile.profileImageUrl.trim(),
        bannerImageUrl: profile.bannerImageUrl.trim(),
        profileImageKey: photo.pendingKey,
        bannerImageKey: banner.pendingKey,
      })
      onSaved(pickFields(updated, PROFILE_FIELDS))
      // 저장된 사진·배너가 현재 이미지가 된다. 이후 저장에는 새 주소를 보내고 이미지는 다시 바꾸지 않은 상태로 둔다.
      // 응답이 이미지 없음(null)이면 이전 주소를 남기지 않는다.
      setProfile((prev) => ({
        ...prev,
        introText: prev.introText === sentIntro ? (updated.introText ?? sentIntro.trim()) : prev.introText,
        profileImageUrl: updated.profileImageUrl ?? '',
        bannerImageUrl: updated.bannerImageUrl ?? '',
      }))
      photo.reset()
      banner.reset()
      return true
    } catch (error) {
      setProfileError(describeSpaceImageError(error, '소개·사진·배너를 저장하지 못했어요.'))
      return false
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

  /**
   * 새 주소로 바꾸거나(restoring=false) 이전 주소로 되돌린다. 바꾸기 전 주소를 이전 주소로 기억한다(되돌릴 때 버린 주소도 14일 예약된다).
   * 성공 여부를 돌려준다. 토스트는 saveAll이 저장 결과를 모아 한 번 띄운다.
   */
  async function applySlug(nextSlug, { restoring }) {
    const before = space.slug
    const slugAtRequest = slug // 응답을 기다리는 동안 주소를 더 고쳤으면 응답이 그 입력을 덮어쓰지 않게 한다.
    setSavingSlug(true)
    setSlugError(null)
    try {
      const updated = await changeMySpaceSlug(nextSlug)
      if (before && before !== updated.slug) rememberPreviousSlug(space.creatorId, before)
      setSlug((current) => (current === slugAtRequest ? updated.slug : current))
      onSaved(pickFields(updated, SLUG_FIELDS))
      return true
    } catch (error) {
      const message = error instanceof ApiError ? SLUG_ERROR_MESSAGES[error.code] : null
      setSlugError(message ?? describeError(error, restoring ? '이전 공유 주소로 되돌리지 못했어요.' : '공유 주소를 바꾸지 못했어요.'))
      // 예약 기간이 지나 다른 사람이 쓰게 된 주소라면 더는 되돌리기로 보여주지 않는다.
      if (restoring && error instanceof ApiError && error.code === 'SLUG_ALREADY_TAKEN') {
        forgetPreviousSlug(space.creatorId)
        setSlugMemoryVersion((current) => current + 1)
      }
      return false
    } finally {
      setSavingSlug(false)
    }
  }

  // 이전 주소로 되돌리기도 바로 저장하지 않고 입력칸에 이전 주소를 채운다. 14일 잠금 중에도 BE가 허용한다.
  const restoringSlug = Boolean(restorableSlug) && slug.trim() === restorableSlug
  function toggleRestoreSlug() {
    setSlugError(null)
    setSlug(restoringSlug ? (space.slug ?? '') : restorableSlug)
  }

  /** 바뀐 항목만 활동명 → 소개·사진·배너 → 공유 주소 순서로 저장한다. 일부가 실패해도 성공한 항목은 반영하고, 실패한 칸에 오류를 남긴다. */
  async function saveAll() {
    setConfirmingSave(false)
    if (!canSave) return
    setSaving(true)
    const results = []
    try {
      if (nameDirty) results.push(await activityName.save())
      if (profileDirty) results.push(await saveProfile())
      if (slugDirty) results.push(await applySlug(slug.trim(), { restoring: restoringSlug }))
    } finally {
      setSaving(false)
    }
    if (results.every(Boolean)) showToast('스페이스 정보를 저장했어요.')
    else if (results.some(Boolean)) showToast('일부 항목을 저장하지 못했어요. 표시된 내용을 확인해주세요.', { icon: 'error' })
    else showToast('저장하지 못했어요. 표시된 내용을 확인해주세요.', { icon: 'error' })
  }

  // 활동명·공유 주소를 새 값으로 바꾸면 14일 동안 다시 바꿀 수 없어, 저장 전에 한 번 확인한다.
  // 활동명을 처음 정하거나, 이전 값으로 되돌리는 경우는 확인하지 않는다.
  const nameLocks = nameDirty && !activityName.firstSetup && !activityName.restoring
  const slugLocks = slugDirty && !restoringSlug
  const needsLockConfirm = nameLocks || slugLocks
  function requestSave() {
    if (!canSave) return
    if (needsLockConfirm) setConfirmingSave(true)
    else void saveAll()
  }

  return (
    <div className="flex flex-col gap-space-lg">
      <ActivityNameSection
        onChange={setActivityName}
        disabled={busy}
        onSaved={(activityName) => onSaved({ creatorName: activityName })}
      />

      <section className="flex flex-col gap-space-sm">
        <h3 className="font-label-md text-label-md font-semibold text-on-surface">홈·프로필</h3>
        <label className="flex flex-col gap-1">
          <span className="font-label-xs text-label-xs text-on-surface-variant">소개</span>
          <textarea
            value={profile.introText}
            maxLength={MAX_TEXT}
            rows={3}
            onChange={(event) => {
              setProfile((prev) => ({ ...prev, introText: event.target.value }))
              setProfileError(null) // 고친 내용까지 실패한 것처럼 보이지 않게, 실패 문구는 입력을 바꾸면 지운다.
            }}
            className={`${inputClass} resize-none`}
          />
        </label>
        <div className="flex flex-col gap-1">
          <span className="font-label-xs text-label-xs text-on-surface-variant">프로필 사진</span>
          <div className="flex items-center gap-space-md">
            <button
              type="button"
              onClick={photo.openPicker}
              disabled={photo.busy || busy}
              aria-label="프로필 사진 변경"
              className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-surface-container active:scale-95 transition-transform disabled:opacity-70"
            >
              {photo.pendingKey === null ? (
                <span className="flex h-full w-full items-center justify-center text-on-surface-variant">
                  <MaterialIcon name="restart_alt" className="text-[40px]" />
                </span>
              ) : (
                <ProfilePhoto src={shownImage} className="h-full w-full" iconClassName="text-[40px]" />
              )}
              {photo.busy && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <Spinner className="h-6 w-6 text-white" />
                </span>
              )}
            </button>
            <input ref={photo.fileInput} type="file" accept="image/jpeg,image/png" className="hidden" onChange={photo.handleFile} />
            <div className="flex flex-col items-start gap-1">
              <button
                type="button"
                onClick={photo.openPicker}
                disabled={photo.busy || busy}
                className="font-label-md text-label-md font-semibold text-primary disabled:opacity-50"
              >
                사진 변경
              </button>
              {photo.pendingKey !== null ? (
                <button
                  type="button"
                  onClick={photo.remove}
                  disabled={photo.busy || busy}
                  className="font-label-sm text-label-sm text-on-surface-variant disabled:opacity-50"
                >
                  기본 이미지로
                </button>
              ) : (
                <button
                  type="button"
                  onClick={photo.cancelRemove}
                  disabled={busy}
                  className="font-label-sm text-label-sm text-on-surface-variant disabled:opacity-50"
                >
                  되돌리기 취소
                </button>
              )}
              <p className="font-label-xs text-label-xs text-on-surface-variant">
                {photo.pendingKey === null
                  ? '저장하면 스페이스 기본 이미지로 돌아가요. 기본 이미지는 저장한 뒤에 확인할 수 있어요.'
                  : 'JPEG·PNG, 5MB 이하, 200×200px 이상'}
              </p>
            </div>
          </div>
          {photo.error && <p className="font-label-xs text-label-xs text-error" role="alert">{photo.error}</p>}
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-label-xs text-label-xs text-on-surface-variant">배너 이미지</span>
          <button
            type="button"
            onClick={banner.openPicker}
            disabled={banner.busy || busy}
            aria-label="배너 이미지 변경"
            className="relative aspect-[3/1] w-full overflow-hidden rounded-xl bg-surface-container active:scale-[0.99] transition-transform disabled:opacity-70"
          >
            {banner.pendingKey === null ? (
              <span className="flex h-full w-full items-center justify-center text-on-surface-variant">
                <MaterialIcon name="restart_alt" className="text-[40px]" />
              </span>
            ) : banner.previewUrl ? (
              <img className="h-full w-full object-cover" src={banner.previewUrl} alt="" />
            ) : (
              <CreatorBanner src={space.bannerImageUrl} />
            )}
            {banner.busy && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                <Spinner className="h-6 w-6 text-white" />
              </span>
            )}
          </button>
          <input ref={banner.fileInput} type="file" accept="image/jpeg,image/png" className="hidden" onChange={banner.handleFile} />
          <div className="flex items-center gap-space-md">
            <button
              type="button"
              onClick={banner.openPicker}
              disabled={banner.busy || busy}
              className="font-label-md text-label-md font-semibold text-primary disabled:opacity-50"
            >
              배너 변경
            </button>
            {banner.pendingKey !== null ? (
              <button
                type="button"
                onClick={banner.remove}
                disabled={banner.busy || busy}
                className="font-label-sm text-label-sm text-on-surface-variant disabled:opacity-50"
              >
                기본 배너로
              </button>
            ) : (
              <button
                type="button"
                onClick={banner.cancelRemove}
                disabled={busy}
                className="font-label-sm text-label-sm text-on-surface-variant disabled:opacity-50"
              >
                되돌리기 취소
              </button>
            )}
          </div>
          <p className="font-label-xs text-label-xs text-on-surface-variant">
            {banner.pendingKey === null
              ? '저장하면 스페이스 기본 배너로 돌아가요. 기본 배너는 저장한 뒤에 확인할 수 있어요.'
              : 'JPEG·PNG, 5MB 이하, 600×200px 이상'}
          </p>
          {banner.error && <p className="font-label-xs text-label-xs text-error" role="alert">{banner.error}</p>}
        </div>
        {profileError && (
          <p className="rounded-xl bg-error-container px-3 py-2.5 font-body-sm text-body-sm text-on-error-container" role="alert">
            {profileError}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-space-sm">
        <h3 className="font-label-md text-label-md font-semibold text-on-surface">공유 주소</h3>
        <label className="flex flex-col gap-1">
          <span className="font-label-xs text-label-xs text-on-surface-variant">/</span>
          <input
            value={slug}
            onChange={(event) => setSlug(event.target.value.toLowerCase())}
            // 14일이 지나기 전에는 새 주소로 바꿀 수 없어 입력을 막는다(활동명과 같다). 이전 주소로 되돌리기는 아래 버튼으로 할 수 있다.
            disabled={busy || slugLocked}
            className={`${inputClass} disabled:opacity-60`}
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
        {slugError && <p className="font-label-xs text-label-xs text-error" role="alert">{slugError}</p>}
        {restorableSlug && (
          <button
            type="button"
            onClick={toggleRestoreSlug}
            disabled={busy}
            className="self-start font-label-sm text-label-sm font-semibold text-primary disabled:opacity-50"
          >
            {restoringSlug ? '되돌리기 취소' : `이전 주소 ‘/${restorableSlug}’로 되돌리기`}
          </button>
        )}
      </section>

      {/* 저장 버튼은 하나다. 시트 내용의 맨 끝(공유 주소 아래)에 두고, 바뀐 항목만 저장한다. */}
      <button
        type="button"
        disabled={!canSave}
        onClick={requestSave}
        className="w-full h-12 rounded-xl bg-primary disabled:opacity-50 text-on-primary font-title-md text-title-md font-bold active:scale-[0.98] transition-all"
      >
        {busy ? '저장하는 중...' : imageBusy ? '이미지 올리는 중...' : '저장'}
      </button>
      <ConfirmSheet
        open={confirmingSave}
        title="변경 내용을 저장할까요?"
        message={
          nameLocks && slugLocks
            ? '활동명과 공유 주소는 바꾸면 14일 동안 다시 바꿀 수 없어요. 이전 이름·주소로 되돌리는 것은 그 전에도 할 수 있어요.'
            : slugLocks
              ? '공유 주소는 바꾸면 14일 동안 다시 바꿀 수 없고, 이전 주소는 열리지 않아요. 이전 주소로 되돌리는 것은 그 전에도 할 수 있어요.'
              : '활동명은 바꾸면 14일 동안 다시 바꿀 수 없어요. 이전 활동명으로 되돌리는 것은 그 전에도 할 수 있어요.'
        }
        confirmLabel="저장하기"
        cancelLabel="취소"
        confirmTone="primary"
        onConfirm={() => void saveAll()}
        onClose={() => setConfirmingSave(false)}
      />
    </div>
  )
}
