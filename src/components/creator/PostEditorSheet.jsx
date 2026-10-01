import { useEffect, useRef, useState } from 'react'
import BottomSheet from '../ui/BottomSheet.jsx'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import { useToast } from '../../context/useToast.js'
import { ApiError, describeError } from '../../api/client.js'
import { POST_ERROR_MESSAGES, POST_LIMITS, createPost, updatePost, uploadPostImage } from '../../api/posts.js'

const inputClass =
  'w-full px-3 py-2.5 rounded-xl bg-surface-container text-on-surface font-body-sm text-body-sm placeholder:text-outline focus:bg-surface-container-lowest focus:outline-none shadow-sm transition-all'

const VISIBILITY_OPTIONS = [
  { value: 'PUBLIC', label: '전체 공개', hint: '누구나 볼 수 있어요.' },
  { value: 'FOLLOWERS', label: '팔로워 공개', hint: '팔로워와 나만 볼 수 있어요. 그 외에는 잠금 카드로 보여요.' },
]

let itemSeq = 0
const nextItemId = () => `image-${++itemSeq}`

function readImageSize(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: image.naturalWidth, height: image.naturalHeight })
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    image.src = url
  })
}

/** 업로드 전에 형식·크기·해상도를 확인한다. 통과하면 null, 아니면 안내 문구. 최종 판단은 서버가 한다. */
async function validateImage(file) {
  if (!POST_LIMITS.imageTypes.includes(file.type)) return 'JPEG 또는 PNG 이미지만 올릴 수 있어요.'
  if (file.size > POST_LIMITS.maxImageBytes) return '이미지는 5MB 이하만 올릴 수 있어요.'
  const size = await readImageSize(file)
  if (!size) return '이미지를 읽을 수 없어요. 손상된 파일이 아닌지 확인해주세요.'
  if (size.width < POST_LIMITS.minImageSize || size.height < POST_LIMITS.minImageSize) {
    return '이미지는 200×200px 이상이어야 해요.'
  }
  return null
}

function describePostError(error, fallback) {
  if (error instanceof ApiError && POST_ERROR_MESSAGES[error.code]) return POST_ERROR_MESSAGES[error.code]
  return describeError(error, fallback)
}

/**
 * 크리에이터 게시글 작성·수정(Cking-BE docs/domains/post/api.md).
 * - 이미지는 고르는 즉시 1장씩 병렬 업로드해 imageKey를 받고, 실패한 이미지는 그 이미지만 다시 시도한다.
 * - 수정은 전체 교체라서 유지할 이미지의 key도 목록 순서대로 다시 보낸다.
 */
export default function PostEditorSheet({ open, onClose, post, onSaved }) {
  // 폼이 "지금 닫아도 되는지"(저장 중이면 막고, 작성 내용이 있으면 확인)를 등록한다.
  const closeGuard = useRef(() => true)
  const registerGuard = (guard) => {
    closeGuard.current = guard
  }
  const requestClose = () => {
    if (closeGuard.current()) onClose()
  }
  return (
    <BottomSheet open={open} onClose={requestClose} eyebrow="Creator Post" title={post ? '게시글 수정' : '게시글 쓰기'}>
      {open && <PostEditorForm post={post} onClose={onClose} onSaved={onSaved} registerGuard={registerGuard} />}
    </BottomSheet>
  )
}

function PostEditorForm({ post, onClose, onSaved, registerGuard }) {
  const showToast = useToast()
  const alive = useRef(true)
  const fileInput = useRef(null)
  const previewUrls = useRef(new Set())
  // 검사·업로드 도중 사용자가 지운 항목은 이후 단계를 건너뛴다.
  const removedIds = useRef(new Set())
  const [content, setContent] = useState(post?.content ?? '')
  const [visibility, setVisibility] = useState(post?.visibility ?? 'PUBLIC')
  const [items, setItems] = useState(() =>
    (post?.images ?? []).map((image) => ({
      id: nextItemId(),
      key: image.imageKey,
      previewUrl: image.url,
      status: 'uploaded',
      error: '',
    })),
  )
  const [saving, setSaving] = useState(false)
  const [initialItemIds] = useState(() => items.map((item) => item.id))
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    alive.current = true
    const urls = previewUrls.current
    return () => {
      alive.current = false
      urls.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [])

  const dirty = content !== (post?.content ?? '')
    || visibility !== (post?.visibility ?? 'PUBLIC')
    || items.length !== initialItemIds.length
    || items.some((item, index) => item.id !== initialItemIds[index])

  useEffect(() => {
    registerGuard(() => {
      if (saving) return false
      return !dirty || window.confirm('작성 중인 내용이 사라져요. 닫을까요?')
    })
    return () => registerGuard(() => true)
  }, [registerGuard, saving, dirty])

  const patchItem = (id, patch) =>
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))

  async function upload(id, file) {
    patchItem(id, { status: 'uploading', error: '' })
    try {
      const { imageKey } = await uploadPostImage(file)
      if (alive.current) patchItem(id, { status: 'uploaded', key: imageKey })
    } catch (error) {
      if (alive.current) patchItem(id, { status: 'failed', error: describePostError(error, '이미지를 올리지 못했어요.') })
    }
  }

  async function handleFiles(event) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    const room = Math.max(POST_LIMITS.maxImages - items.length, 0)
    if (files.length > room) showToast(`이미지는 최대 ${POST_LIMITS.maxImages}장까지 올릴 수 있어요.`, { icon: 'error' })
    // 해상도 검사가 끝나기 전에도 목록에 올려서(checking) 그동안 저장되지 않게 한다.
    const added = files.slice(0, room).map((file) => {
      const previewUrl = URL.createObjectURL(file)
      previewUrls.current.add(previewUrl)
      return { id: nextItemId(), key: null, previewUrl, file, status: 'checking', error: '' }
    })
    setItems((current) => [...current, ...added])
    await Promise.all(added.map(async ({ id, file }) => {
      const reason = await validateImage(file)
      if (!alive.current || removedIds.current.has(id)) return
      if (reason) patchItem(id, { status: 'failed', error: reason, invalid: true })
      else upload(id, file)
    }))
  }

  const removeItem = (id) => {
    removedIds.current.add(id)
    setItems((current) => current.filter((item) => item.id !== id))
  }

  function moveItem(id, delta) {
    setItems((current) => {
      const from = current.findIndex((item) => item.id === id)
      const to = from + delta
      if (from < 0 || to < 0 || to >= current.length) return current
      const next = [...current]
      ;[next[from], next[to]] = [next[to], next[from]]
      return next
    })
  }

  const uploading = items.some((item) => item.status === 'uploading' || item.status === 'checking')
  const failed = items.some((item) => item.status === 'failed')
  const hasBody = content.trim().length > 0 || items.length > 0
  const canSubmit = hasBody && !uploading && !failed && !saving

  let blockedReason = ''
  if (uploading) blockedReason = '이미지를 확인하고 올리는 중이에요.'
  else if (failed) blockedReason = '올리지 못한 이미지를 다시 시도하거나 지워주세요.'
  else if (!hasBody) blockedReason = '본문이나 이미지 중 하나는 있어야 해요.'

  async function submit() {
    setSaving(true)
    setSubmitError('')
    const body = { content: content.trim(), visibility, imageKeys: items.map((item) => item.key) }
    try {
      const saved = post ? await updatePost(post.postId, body) : await createPost(body)
      showToast(post ? '게시글을 수정했어요.' : '게시글을 올렸어요.')
      onSaved(saved)
      onClose()
    } catch (error) {
      setSubmitError(describePostError(error, '게시글을 저장하지 못했어요.'))
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-space-md pb-space-md">
      <label className="flex flex-col gap-1">
        <span className="font-label-xs text-label-xs text-on-surface-variant">본문</span>
        <textarea
          value={content}
          maxLength={POST_LIMITS.maxContent}
          rows={5}
          onChange={(event) => setContent(event.target.value)}
          placeholder="팬들에게 전할 이야기를 적어보세요."
          className={`${inputClass} resize-none`}
        />
        <span className="self-end font-label-xs text-label-xs text-outline">
          {content.length}/{POST_LIMITS.maxContent}
        </span>
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-label-xs text-label-xs text-on-surface-variant">공개 범위</legend>
        {VISIBILITY_OPTIONS.map((option) => (
          <label
            key={option.value}
            className={`flex cursor-pointer items-start gap-3 rounded-xl p-3 ${visibility === option.value ? 'bg-surface-container-high' : 'bg-surface-container'}`}
          >
            <input
              type="radio"
              name="post-visibility"
              value={option.value}
              checked={visibility === option.value}
              onChange={() => setVisibility(option.value)}
              className="mt-1"
            />
            <span className="flex flex-col">
              <span className="font-label-md text-label-md font-semibold text-on-surface">{option.label}</span>
              <span className="font-label-xs text-label-xs text-on-surface-variant">{option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="font-label-xs text-label-xs text-on-surface-variant">
            이미지 {items.length}/{POST_LIMITS.maxImages}
          </span>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={items.length >= POST_LIMITS.maxImages || saving}
            className="flex items-center gap-1 rounded-xl bg-surface-container px-3 py-2 font-label-sm text-label-sm font-semibold text-on-surface disabled:opacity-50"
          >
            <MaterialIcon name="add_photo_alternate" className="text-[18px]" />
            이미지 추가
          </button>
        </div>
        <p className="font-label-xs text-label-xs text-outline">
          JPEG·PNG, 5MB 이하, 200×200px 이상, 최대 5장. 목록 순서가 게시글에 보이는 순서예요.
        </p>
        <input ref={fileInput} type="file" accept="image/jpeg,image/png" multiple hidden onChange={handleFiles} />
        {items.length > 0 && (
          <ul className="flex flex-col gap-2">
            {items.map((item, index) => (
              <li key={item.id} className="flex items-center gap-3 rounded-xl bg-surface-container p-2">
                {item.previewUrl ? (
                  <img src={item.previewUrl} alt={`이미지 ${index + 1} 미리보기`} className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-on-surface-variant">
                    <MaterialIcon name="broken_image" />
                  </div>
                )}
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-label-sm text-label-sm text-on-surface">이미지 {index + 1}</span>
                  {item.status === 'checking' && <span className="font-label-xs text-label-xs text-on-surface-variant">확인하는 중...</span>}
                  {item.status === 'uploading' && <span className="font-label-xs text-label-xs text-on-surface-variant">올리는 중...</span>}
                  {item.status === 'uploaded' && <span className="font-label-xs text-label-xs text-on-surface-variant">준비됐어요</span>}
                  {item.status === 'failed' && (
                    <span className="font-label-xs text-label-xs text-error">
                      {item.error}
                      {!item.invalid && (
                        <button type="button" onClick={() => upload(item.id, item.file)} className="ml-2 font-semibold text-primary underline">
                          다시 시도
                        </button>
                      )}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 items-center">
                  <button type="button" aria-label={`이미지 ${index + 1} 위로`} onClick={() => moveItem(item.id, -1)} disabled={index === 0 || saving} className="p-1.5 text-on-surface-variant disabled:opacity-30">
                    <MaterialIcon name="arrow_upward" className="text-[18px]" />
                  </button>
                  <button type="button" aria-label={`이미지 ${index + 1} 아래로`} onClick={() => moveItem(item.id, 1)} disabled={index === items.length - 1 || saving} className="p-1.5 text-on-surface-variant disabled:opacity-30">
                    <MaterialIcon name="arrow_downward" className="text-[18px]" />
                  </button>
                  <button type="button" aria-label={`이미지 ${index + 1} 삭제`} onClick={() => removeItem(item.id)} disabled={saving} className="p-1.5 text-on-surface-variant disabled:opacity-30">
                    <MaterialIcon name="close" className="text-[18px]" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {submitError && <p className="font-label-xs text-label-xs text-error" role="alert">{submitError}</p>}
      {!canSubmit && blockedReason && !saving && <p className="font-label-xs text-label-xs text-on-surface-variant">{blockedReason}</p>}
      <button
        type="button"
        disabled={!canSubmit}
        onClick={submit}
        className="h-11 w-full rounded-xl bg-primary font-label-md text-label-md font-semibold text-on-primary transition-all active:scale-[0.98] disabled:opacity-50"
      >
        {saving ? '저장하는 중...' : post ? '수정 저장' : '게시하기'}
      </button>
    </div>
  )
}
