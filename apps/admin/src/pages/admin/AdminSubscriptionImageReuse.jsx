import { useRef, useState } from 'react'
import { getSubscriptionVerificationImageReuse } from '../../api/admin.js'
import { ApiError, describeError } from '../../api/client.js'
import { AdminPageHeader, DetailInfoRows } from '../../components/AdminContent.jsx'
import { EmptyBlock, ErrorBlock, LoadingBlock, StatusPill } from '../../components/States.jsx'
import { formatDateTime } from '../../utils/format.js'
import { imageReuseTypeMeta, parseVerificationId } from '../../utils/subscriptionImageReuse.js'

/** Verification ID로 이미지 exact-match 감사 결과 한 건을 조회한다. */
export default function AdminSubscriptionImageReuse() {
  const [verificationId, setVerificationId] = useState('')
  const [submittedId, setSubmittedId] = useState(null)
  const [result, setResult] = useState(null)
  const [inputError, setInputError] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const requestVersion = useRef(0)

  /** 새 조회를 시작할 때 이전 결과와 오류를 비우고 요청 세대가 같은 응답만 반영한다. */
  async function load(parsedId) {
    const version = requestVersion.current + 1
    requestVersion.current = version
    setError('')
    setResult(null)
    setSubmittedId(parsedId)
    setLoading(true)
    try {
      const nextResult = await getSubscriptionVerificationImageReuse(parsedId)
      if (requestVersion.current === version) setResult(nextResult)
    } catch (requestError) {
      if (requestVersion.current !== version) return
      setError(requestError instanceof ApiError && requestError.code === 'VERIFICATION_NOT_FOUND'
        ? `Verification #${parsedId}의 재사용 탐지 결과를 찾을 수 없습니다.`
        : describeError(requestError, '이미지 재사용 탐지 결과를 조회하지 못했습니다.'))
    } finally {
      if (requestVersion.current === version) setLoading(false)
    }
  }

  /** 입력을 검증한 뒤 현재 Verification ID를 조회한다. */
  function search(event) {
    event.preventDefault()
    const parsedId = parseVerificationId(verificationId)
    if (parsedId == null) {
      requestVersion.current += 1
      setInputError('Verification ID는 1 이상의 정수로 입력해주세요.')
      setError('')
      setResult(null)
      setSubmittedId(null)
      setLoading(false)
      return
    }

    setInputError('')
    void load(parsedId)
  }

  const reuseMeta = result ? imageReuseTypeMeta(result.reuseType) : null

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <AdminPageHeader
        title="구독 인증 재사용"
        description="Verification ID로 정규화 이미지의 exact-match 재사용 탐지 결과를 조회합니다."
      />

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <form onSubmit={search} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm font-medium text-slate-800">
            Verification ID
            <input
              value={verificationId}
              onChange={(event) => setVerificationId(event.target.value)}
              inputMode="numeric"
              autoComplete="off"
              placeholder="예: 123"
              aria-describedby="verification-id-help"
              className="mt-2 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-pink-600 focus:ring-1 focus:ring-pink-600"
            />
          </label>
          <button type="submit" disabled={loading} className="h-10 rounded-md bg-pink-700 px-5 text-sm font-semibold text-white hover:bg-pink-800 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? '조회 중...' : '조회'}
          </button>
        </form>
        <p id="verification-id-help" className="mt-2 text-xs leading-5 text-slate-500">구독 인증 제출 처리에서 발급된 양의 정수 ID를 입력하세요.</p>
        {inputError && <p role="alert" className="mt-3 text-sm text-red-700">{inputError}</p>}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white">
        {loading && <LoadingBlock label={`Verification #${submittedId}의 탐지 결과를 조회하는 중...`} />}
        {!loading && error && <ErrorBlock message={error} onRetry={() => void load(submittedId)} />}
        {!loading && !error && !result && <EmptyBlock icon="image_search" message="조회할 Verification ID를 입력해주세요." />}
        {!loading && !error && result && (
          <>
            <div className="border-b border-slate-200 px-5 py-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-950">Verification #{result.verificationId}</h2>
                  <p className="mt-1 text-sm text-slate-500">저장된 이미지 재사용 감사 결과입니다.</p>
                </div>
                <StatusPill label={reuseMeta.label} tone={reuseMeta.tone} icon="image_search" />
              </div>
              <p className="mt-4 rounded-md bg-slate-50 p-4 text-sm leading-6 text-slate-700">{reuseMeta.description}</p>
            </div>
            <DetailInfoRows title="탐지 결과" rows={[
              ['조회 Verification ID', `#${result.verificationId}`],
              ['이전 일치 Verification', result.matchedVerificationId == null ? '없음' : `#${result.matchedVerificationId}`],
              ['재사용 유형', reuseMeta.label],
              ['탐지 시각', formatDateTime(result.detectedAt)],
            ]} />
          </>
        )}
      </section>

      <aside className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
        이 결과는 정규화 이미지 SHA-256의 exact match 운영 신호입니다. 이미지·hash는 노출하지 않으며, 조회 자체가 VLM 판정·인증 상태·응모권 보상을 변경하지 않습니다.
      </aside>
    </div>
  )
}
