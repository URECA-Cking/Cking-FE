import { useState } from 'react'
import BottomSheet from '../ui/BottomSheet.jsx'
import { ErrorBlock, LoadingBlock } from '../ui/States.jsx'
import { useToast } from '../../context/useToast.js'
import { ApiError } from '../../api/client.js'
import { useAsync } from '../../hooks/useAsync.js'
import {
  describeSubscriptionVerificationError,
  getMyYoutubeChannel,
  updateMyYoutubeChannel,
} from '../../api/subscriptionVerification.js'

const MAX_LENGTH = 100
const inputClass =
  'w-full rounded-xl bg-surface-container px-3 py-2.5 font-body-sm text-body-sm text-on-surface shadow-sm placeholder:text-outline focus:bg-surface-container-lowest focus:outline-none'

/** 크리에이터가 저장한 구독 인증 대상 YouTube 채널을 불러온다. */
async function loadMyYoutubeChannel() {
  try {
    return await getMyYoutubeChannel()
  } catch (error) {
    if (error instanceof ApiError && error.code === 'CREATOR_CHANNEL_NOT_CONFIGURED') return null
    throw error
  }
}

/** Creator가 Space 편집 화면에서 구독 인증 대상 YouTube 채널을 설정한다. */
export default function YoutubeChannelSheet({ open, onClose }) {
  const { data: channel, loading, error, reload, setData } = useAsync(
    loadMyYoutubeChannel,
    [open],
    { enabled: open, fallbackMessage: 'YouTube 채널 설정을 불러오지 못했어요.' },
  )

  return (
    <BottomSheet open={open} onClose={onClose} eyebrow="YouTube" title="구독 인증 채널 설정">
      {loading ? <LoadingBlock label="채널 설정을 불러오는 중..." /> : error ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : (
        <YoutubeChannelForm
          key={channel?.updatedAt ?? 'not-configured'}
          initialChannel={channel}
          onSaved={setData}
        />
      )}
    </BottomSheet>
  )
}

/** 채널명과 handle을 입력받아 구독 인증 대상 채널을 저장하는 폼을 표시한다. */
function YoutubeChannelForm({ initialChannel, onSaved }) {
  const showToast = useToast()
  const [channelName, setChannelName] = useState(initialChannel?.channelName ?? '')
  const [channelHandle, setChannelHandle] = useState(initialChannel?.channelHandle ?? '')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  /** 입력값을 검증한 뒤 구독 인증 대상 채널을 저장하고 최신 상태를 반영한다. */
  async function save(event) {
    event.preventDefault()
    const name = channelName.trim()
    const handle = channelHandle.trim()
    if (!name || !handle) {
      setFormError('채널명과 채널 handle을 모두 입력해주세요.')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      const updated = await updateMyYoutubeChannel({ channelName: name, channelHandle: handle })
      const firstSetup = initialChannel === null
      onSaved(updated)
      setChannelName(updated.channelName)
      setChannelHandle(updated.channelHandle)
      showToast(firstSetup ? 'YouTube 채널을 설정했어요. 구독 인증 미션이 생성되었어요.' : 'YouTube 채널 설정을 저장했어요.')
    } catch (error) {
      setFormError(describeSubscriptionVerificationError(error, 'YouTube 채널을 저장하지 못했어요.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-space-md pb-space-md">
      <p className="font-body-sm text-body-sm leading-relaxed text-on-surface-variant">
        팬이 이 채널을 구독한 화면을 제출해 인증받을 수 있어요. 처리 중인 인증이 있으면 다른 채널로 변경할 수 없어요.
      </p>
      <label className="flex flex-col gap-1">
        <span className="font-label-xs text-label-xs text-on-surface-variant">채널명</span>
        <input value={channelName} maxLength={MAX_LENGTH} onChange={(event) => setChannelName(event.target.value)} placeholder="채널명을 입력해주세요" className={inputClass} disabled={saving} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-label-xs text-label-xs text-on-surface-variant">채널 handle</span>
        <input
          value={channelHandle}
          maxLength={MAX_LENGTH}
          onChange={(event) => setChannelHandle(event.target.value)}
          placeholder="핸들명을 입력해주세요. ex. @example"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className={inputClass}
          disabled={saving}
        />
        <span className="font-label-xs text-label-xs text-outline">@는 입력하지 않아도 자동으로 붙어요.</span>
      </label>
      {formError && <p className="font-label-xs text-label-xs text-error" role="alert">{formError}</p>}
      <button type="submit" disabled={saving} className="h-11 rounded-xl bg-primary font-label-md text-label-md font-bold text-on-primary transition-all active:scale-[0.98] disabled:opacity-50">
        {saving ? '저장하는 중...' : initialChannel ? '채널 설정 저장' : '채널 설정하고 미션 만들기'}
      </button>
    </form>
  )
}
