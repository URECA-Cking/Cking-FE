import { useState } from 'react'
import BottomSheet from '../ui/BottomSheet.jsx'
import { ErrorBlock, LoadingBlock } from '../ui/States.jsx'
import { useToast } from '../../context/useToast.js'
import { ApiError } from '../../api/client.js'
import { useAsync } from '../../hooks/useAsync.js'
import {
  describeSubscriptionVerificationError,
  getYoutubeChannelConnection,
  startYoutubeChannelConnection,
  updateMyYoutubeChannel,
} from '../../api/subscriptionVerification.js'

const MAX_LENGTH = 100
const inputClass =
  'w-full rounded-xl bg-surface-container px-3 py-2.5 font-body-sm text-body-sm text-on-surface shadow-sm placeholder:text-outline focus:bg-surface-container-lowest focus:outline-none'

/** Creator가 Space 편집 화면에서 구독 인증 대상 YouTube 채널을 설정한다. */
export default function YoutubeChannelSheet({ open, onClose, canOperate = true }) {
  const { data: connection, loading, error, reload, setData } = useAsync(
    getYoutubeChannelConnection,
    [open],
    { enabled: open, fallbackMessage: 'YouTube 채널 설정을 불러오지 못했어요.' },
  )

  return (
    <BottomSheet open={open} onClose={onClose} eyebrow="YouTube" title="구독 인증 채널 설정">
      {loading ? <LoadingBlock label="채널 설정을 불러오는 중..." /> : error ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : (
        <YoutubeChannelForm
          key={connection?.channel?.updatedAt ?? 'not-configured'}
          initialChannel={connection?.channel ?? null}
          verificationStatus={connection?.verificationStatus ?? 'NOT_CONNECTED'}
          onSaved={(updated) => setData({ channel: updated, verificationStatus: updated.verificationStatus ?? 'UNVERIFIED' })}
          canOperate={canOperate}
        />
      )}
    </BottomSheet>
  )
}

/** 채널명과 채널 아이디(@handle)를 입력받아 구독 인증 대상 채널을 저장하는 폼을 표시한다. */
function YoutubeChannelForm({ initialChannel, verificationStatus, onSaved, canOperate }) {
  const showToast = useToast()
  const [channelName, setChannelName] = useState(initialChannel?.channelName ?? '')
  const [channelHandle, setChannelHandle] = useState(initialChannel?.channelHandle ?? '')
  const [saving, setSaving] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [formError, setFormError] = useState('')

  /** 입력값을 검증한 뒤 구독 인증 대상 채널을 저장하고 최신 상태를 반영한다. */
  async function save(event) {
    event.preventDefault()
    const name = channelName.trim()
    const handle = channelHandle.trim()
    if (!name || !handle) {
      setFormError('채널명과 채널 아이디를 모두 입력해주세요.')
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
      showToast(firstSetup ? 'YouTube 채널을 설정했어요. 소유권을 인증하면 미션을 열 수 있어요.' : 'YouTube 채널 설정을 저장했어요.')
    } catch (error) {
      const message = describeSubscriptionVerificationError(error, 'YouTube 채널을 저장하지 못했어요.')
      // 다른 크리에이터가 이미 쓰는 채널 아이디는 저장되지 않으므로 토스트로만 알리고, 입력값은 그대로 둬 고쳐서 다시 시도하게 한다.
      if (error instanceof ApiError && error.code === 'CHANNEL_HANDLE_CONFLICT') showToast(message, { icon: 'error' })
      else setFormError(message)
    } finally {
      setSaving(false)
    }
  }

  async function connectYoutube() {
    const handle = channelHandle.trim()
    if (!handle) { setFormError('먼저 인증할 채널 아이디를 입력해주세요.'); return }
    setConnecting(true); setFormError('')
    try {
      const result = await startYoutubeChannelConnection(handle)
      if (!result?.authorizationUrl) throw new Error('인증 주소를 받지 못했어요.')
      window.location.assign(result.authorizationUrl)
    } catch (error) {
      setFormError(describeSubscriptionVerificationError(error, 'YouTube 연결을 시작하지 못했어요.'))
      setConnecting(false)
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-space-md pb-space-md">
      <p className="font-body-sm text-body-sm leading-relaxed text-on-surface-variant">
        YouTube 계정을 연결해 채널 소유권을 인증하면 구독 인증 미션을 OPEN 할 수 있어요.
      </p>
      <label className="flex flex-col gap-1">
        <span className="font-label-xs text-label-xs text-on-surface-variant">채널명</span>
        <input value={channelName} maxLength={MAX_LENGTH} onChange={(event) => setChannelName(event.target.value)} placeholder="채널명을 입력해주세요" className={inputClass} disabled={saving} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-label-xs text-label-xs text-on-surface-variant">채널 아이디</span>
        <input
          value={channelHandle}
          maxLength={MAX_LENGTH}
          onChange={(event) => setChannelHandle(event.target.value)}
          placeholder="유튜브 채널 아이디를 입력해주세요. (예: @example)"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className={inputClass}
          disabled={saving}
        />
        <span className="font-label-xs text-label-xs text-outline">채널 이름 아래에 보이는 @로 시작하는 이름이에요. @는 입력하지 않아도 자동으로 붙어요.</span>
      </label>
      {formError && <p className="font-label-xs text-label-xs text-error" role="alert">{formError}</p>}
      <button type="submit" disabled={saving || !canOperate} className="h-11 rounded-xl bg-primary font-label-md text-label-md font-bold text-on-primary transition-all active:scale-[0.98] disabled:opacity-50">
        {saving ? '저장하는 중...' : '채널 설정 저장'}
      </button>
      <button type="button" onClick={connectYoutube} disabled={!canOperate || saving || connecting} className="h-11 rounded-xl bg-secondary-fixed font-label-md text-label-md font-bold text-on-secondary-fixed transition-all active:scale-[0.98] disabled:opacity-50">{connecting ? 'YouTube로 이동하는 중...' : verificationStatus === 'VERIFIED' ? 'YouTube 채널 다시 인증' : 'YouTube 채널 소유권 인증'}</button>
      <p className="font-label-xs text-label-xs text-outline" role="status">인증 상태: {verificationStatus === 'VERIFIED' ? '인증 완료' : verificationStatus === 'REVOKED' ? '인증 해제' : verificationStatus === 'UNVERIFIED' ? '인증 필요' : '연결 전'}</p>
    </form>
  )
}
