import { useEffect, useRef, useState } from 'react'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import { LoadingBlock } from '../ui/States.jsx'
import { ApiError, newRequestId } from '../../api/client.js'
import { useAsync } from '../../hooks/useAsync.js'
import {
  describeSubscriptionVerificationError,
  getLatestSubscriptionVerification,
  submitSubscriptionVerification,
  validateSubscriptionVerificationImage,
} from '../../api/subscriptionVerification.js'
import { toSafeImageUrl } from '../../utils/safeUrl.js'
import {
  canResubmitSubscriptionVerification,
  isSubscriptionRewardRecovery,
  shouldPollSubscriptionVerification,
} from '../../utils/subscriptionVerificationState.js'

const POLL_INTERVAL_MS = 3000

const STATUS = {
  VERIFYING: {
    icon: 'sync',
    title: '구독 인증을 확인하고 있어요',
    detail: '잠시만 기다려주세요. 완료되면 자동으로 상태가 바뀌어요.',
    tone: 'bg-secondary-container text-on-secondary-container',
  },
  VERIFIED: {
    icon: 'verified',
    title: '구독 인증이 완료되었어요',
    detail: '크리에이터 전용 응모권 1장이 지급되었어요.',
    tone: 'bg-emerald-100 text-emerald-800',
  },
  REJECTED: {
    icon: 'cancel',
    title: '구독 인증이 승인되지 않았어요',
    detail: '구독 상태와 채널명이 잘 보이는 캡처로 다시 제출할 수 있어요.',
    tone: 'bg-error-container text-on-error-container',
  },
  RETRY_REQUIRED: {
    icon: 'refresh',
    title: '다시 확인이 필요해요',
    detail: '화면 정보가 부족했어요. 구독 상태와 채널명이 보이게 다시 제출해주세요.',
    tone: 'bg-tertiary-container text-on-tertiary-container',
  },
  TEMPORARY_ERROR: {
    icon: 'schedule',
    title: '인증 결과를 복구하고 있어요',
    detail: '처리 또는 보상 지급을 자동으로 다시 시도하고 있어요. 잠시 후 다시 확인해주세요.',
    tone: 'bg-surface-container-high text-on-surface',
  },
}

const FAILED_STATUS = {
  icon: 'error_outline',
  title: '인증 처리가 완료되지 않았어요',
  detail: '잠시 후 새 이미지로 다시 제출해주세요.',
  tone: 'bg-tertiary-container text-on-tertiary-container',
}

function reasonMessage(reasonCode) {
  return {
    PLATFORM_MISMATCH: 'YouTube 화면인지 확인해주세요.',
    CHANNEL_MISMATCH: '대상 크리에이터의 채널인지 확인해주세요.',
    NOT_SUBSCRIBED: '구독 완료 상태가 보이는 화면을 제출해주세요.',
    INSUFFICIENT_EVIDENCE: '채널명과 구독 상태가 한 화면에 보이도록 제출해주세요.',
    LOW_CONFIDENCE: '이미지가 선명한지 확인한 뒤 다시 제출해주세요.',
  }[reasonCode] ?? null
}

async function loadLatestSubscriptionVerification(creatorId, missionId) {
  try {
    return await getLatestSubscriptionVerification(creatorId, missionId)
  } catch (error) {
    if (error instanceof ApiError && error.code === 'VERIFICATION_NOT_FOUND') return null
    throw error
  }
}

/** 한 Creator의 YOUTUBE_SUBSCRIPTION 미션 제출·상태 조회 카드. */
export default function YoutubeSubscriptionMissionCard({ creatorId, mission, channel, onRewarded }) {
  const {
    data: verification,
    loading,
    error: loadError,
    reload: reloadLatest,
    setData: setVerification,
  } = useAsync(
    () => loadLatestSubscriptionVerification(creatorId, mission.missionId),
    [creatorId, mission.missionId],
    { fallbackMessage: '인증 상태를 불러오지 못했어요.' },
  )
  const [selectedFile, setSelectedFile] = useState(null)
  const [fileError, setFileError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // 고른 이미지의 미리보기 주소(blob:). 브라우저 안에서만 만들고 서버로는 보내지 않으며, 바뀌거나 사라지면 해제한다.
  const [previewUrl, setPreviewUrl] = useState(null)
  const [failedPreviewUrl, setFailedPreviewUrl] = useState(null)
  const requestIdRef = useRef(null)
  const fileInput = useRef(null)
  const rewardedRef = useRef(false)

  useEffect(() => {
    rewardedRef.current = false
  }, [creatorId, mission.missionId])

  useEffect(() => {
    if (verification?.status !== 'VERIFIED' || rewardedRef.current) return
    rewardedRef.current = true
    onRewarded?.()
  }, [verification?.status, onRewarded])

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  useEffect(() => {
    if (!shouldPollSubscriptionVerification(verification)) return undefined
    const timer = window.setInterval(reloadLatest, POLL_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [verification, reloadLatest])

  function selectFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || submitting) return
    const error = validateSubscriptionVerificationImage(file)
    setFileError(error ?? '')
    setSubmitError('')
    if (error) {
      setSelectedFile(null)
      setPreviewUrl(null)
      return
    }
    // 네트워크 오류 뒤 같은 파일은 선택 상태를 유지해 같은 requestId로 재시도한다.
    // 사용자가 파일 선택을 다시 하면 새 요청으로 간주해 멱등성 충돌을 막는다.
    requestIdRef.current = null
    setSelectedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  async function submit() {
    if (!selectedFile || submitting) return
    setSubmitting(true)
    setSubmitError('')
    // 응답을 받지 못한 네트워크 재시도에는 같은 UUID를 유지한다. 서버 응답을 받은 뒤에만 새 제출로 바꾼다.
    const requestId = requestIdRef.current ?? newRequestId()
    requestIdRef.current = requestId
    try {
      const submitted = await submitSubscriptionVerification({
        creatorId,
        missionId: mission.missionId,
        requestId,
        image: selectedFile,
      })
      requestIdRef.current = null
      setSelectedFile(null)
      setPreviewUrl(null)
      setVerification(submitted)
      await reloadLatest()
    } catch (error) {
      // 네트워크 단절이면 서버가 저장했는지 알 수 없으므로 같은 requestId로 다시 보낸다.
      if (!(error instanceof ApiError) || error.code !== 'NETWORK_ERROR') requestIdRef.current = null
      setSubmitError(describeSubscriptionVerificationError(error))
      if (error instanceof ApiError && ['VERIFICATION_IN_PROGRESS', 'VERIFICATION_ALREADY_APPROVED'].includes(error.code)) {
        await reloadLatest()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const status = verification?.status ?? null
  const statusInfo = status === 'TEMPORARY_ERROR' && !isSubscriptionRewardRecovery(verification)
    ? FAILED_STATUS
    : status ? STATUS[status] : null
  const canSubmit = canResubmitSubscriptionVerification(verification)
  // 미리보기는 브라우저가 만든 blob: 주소만 이미지로 그린다(다른 스킴은 허용하지 않는 공통 검사).
  const safePreviewUrl = toSafeImageUrl(previewUrl)

  return (
    <article className="flex flex-col gap-3 rounded-xl bg-surface-container-lowest p-space-md shadow-card">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-container-high text-primary">
          <MaterialIcon name="subscriptions" filled className="text-[22px]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-label-md text-label-md font-semibold text-on-surface">YouTube 구독 인증</p>
          <p className="font-label-xs text-label-xs text-secondary">응모권 +{mission.rewardAmount}</p>
          <a href={channel.channelUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex max-w-full items-center gap-1 font-label-xs text-label-xs text-primary underline underline-offset-2">
            <span className="truncate">{channel.channelName} · {channel.channelHandle}</span>
            <MaterialIcon name="open_in_new" className="text-[14px]" />
          </a>
        </div>
      </div>

      {loading ? <LoadingBlock label="이전 인증을 확인하는 중..." /> : loadError ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-error-container px-3 py-2.5">
          <p className="font-label-xs text-label-xs text-on-error-container">{loadError}</p>
          <button type="button" onClick={reloadLatest} className="shrink-0 font-label-sm text-label-sm font-bold text-on-error-container underline">다시 시도</button>
        </div>
      ) : (
        <>
          {statusInfo && (
            <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 ${statusInfo.tone}`}>
              <MaterialIcon name={statusInfo.icon} className={`mt-0.5 text-[18px] ${shouldPollSubscriptionVerification(verification) ? 'animate-spin' : ''}`} />
              <div>
                <p className="font-label-sm text-label-sm font-bold">{statusInfo.title}</p>
                <p className="mt-0.5 font-label-xs text-label-xs leading-relaxed opacity-80">{reasonMessage(verification.reasonCode) ?? statusInfo.detail}</p>
              </div>
            </div>
          )}

          {canSubmit && (
            <div className="flex flex-col gap-2 rounded-xl bg-surface-container-low p-3">
              <p className="font-label-xs text-label-xs leading-relaxed text-on-surface-variant">구독 완료 상태와 채널명이 함께 보이는 화면을 올려주세요. JPEG·PNG, 5MB 이하 파일만 제출할 수 있어요.</p>
              <input ref={fileInput} type="file" accept="image/jpeg,image/png" className="hidden" onChange={selectFile} />
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => fileInput.current?.click()} disabled={submitting} className="h-10 flex-1 rounded-lg bg-surface-container-highest font-label-sm text-label-sm font-semibold text-on-surface disabled:opacity-50">
                  {selectedFile ? '다른 이미지 선택' : '인증 이미지 선택'}
                </button>
                <button type="button" onClick={submit} disabled={!selectedFile || submitting} className="h-10 flex-1 rounded-lg bg-primary font-label-sm text-label-sm font-bold text-on-primary disabled:opacity-50">
                  {submitting ? '제출 중...' : '인증 제출'}
                </button>
              </div>
              {/* 세로 폰 캡처도 채널명·구독 상태 글씨를 읽을 수 있게 화면 높이의 60%까지 키운다. */}
              {selectedFile && safePreviewUrl && (
                failedPreviewUrl === safePreviewUrl ? (
                  <p className="font-label-xs text-label-xs text-on-surface-variant">미리보기를 표시하지 못했어요. 이미지가 맞다면 그대로 제출할 수 있어요.</p>
                ) : (
                  <img
                    src={safePreviewUrl}
                    alt="선택한 인증 이미지 미리보기"
                    onError={() => setFailedPreviewUrl(safePreviewUrl)}
                    className="max-h-[60dvh] w-full rounded-lg bg-surface-container object-contain"
                  />
                )
              )}
              {selectedFile && <p className="truncate font-label-xs text-label-xs text-on-surface-variant">선택됨: {selectedFile.name}</p>}
              {(fileError || submitError) && <p className="font-label-xs text-label-xs text-error" role="alert">{fileError || submitError}</p>}
            </div>
          )}
        </>
      )}
    </article>
  )
}
