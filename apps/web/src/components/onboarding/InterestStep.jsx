import { useEffect, useMemo, useState } from 'react'
import { getInterests, getMyInterests, saveMyInterests } from '../../api/interests.js'
import { describeError } from '../../api/client.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useToast } from '../../context/useToast.js'
import { LoadingBlock, ErrorBlock, EmptyBlock } from '../ui/States.jsx'
import OnboardingFooter, { GhostButton, PrimaryButton } from './OnboardingFooter.jsx'
import { DUMMY_SUBTAGS, SUBTAG_MAX_PER_PARENT, loadDummySubtags, saveDummySubtags, subtagsExperimentOn } from '../../data/interestSubtagsDummy.js'
import { useUser } from '../../context/useUser.js'

const sameSet = (a, b) => a.length === b.length && a.every((code) => b.includes(code))

/**
 * 온보딩 1단계: 관심 분야 선택(0~3개, 건너뛰기 가능).
 *
 * 선택 수 상한은 응답의 maxSelection으로 화면에서 먼저 막고, 저장할 taxonomyVersion은
 * GET /api/interests 응답 값을 쓴다(내 선택에 딸린 과거 버전은 분류체계가 바뀌면 저장이 400이 된다).
 * 바꾼 것이 없으면 저장하지 않고 넘어간다.
 */
function InterestStepContent({ onDone, memberId }) {
  const showToast = useToast()
  const { data, loading, error, reload } = useAsync(
    async () => {
      const [catalog, mine] = await Promise.all([getInterests(), getMyInterests()])
      return { catalog, mine }
    },
    [],
    { fallbackMessage: '관심 분야를 불러오지 못했어요.' },
  )
  // null이면 아직 사용자가 건드리지 않았으므로 서버에 저장된 선택을 그대로 보여준다.
  const [picked, setPicked] = useState(null)
  const [saving, setSaving] = useState(false)
  // 실험: 상위 분야를 고르면 세부 태그를 고를 수 있다(더미 데이터, 서버 저장 없음, 이슈 #83).
  // 개발 서버에서만 켜지고(?subtags=0이면 끔) 배포 빌드에서는 코드와 더미 데이터가 번들에서 빠진다.
  const subtagsOn = import.meta.env.DEV && subtagsExperimentOn()
  const [subPicked, setSubPicked] = useState(() => (subtagsOn && memberId != null ? loadDummySubtags(memberId) : []))
  // 렌더 값이 아니라 직전 상태 기준으로 바꾸고(빠르게 연달아 눌러도 앞선 선택을 잃지 않는다), 저장은 변경 뒤에 따로 한다.
  useEffect(() => {
    if (subtagsOn && memberId != null) saveDummySubtags(memberId, subPicked)
  }, [subtagsOn, memberId, subPicked])

  const catalog = data?.catalog
  const items = useMemo(() => catalog?.items ?? [], [catalog])
  const saved = useMemo(() => data?.mine?.interestCodes ?? [], [data])
  const current = picked ?? saved
  const max = catalog?.maxSelection ?? 3
  // 활성 분류체계가 없으면 저장할 수 없으므로 고르는 화면 대신 안내만 한다.
  const selectable = Boolean(catalog?.taxonomyVersion) && items.length > 0
  const changed = selectable && picked !== null && !sameSet(picked, saved)

  // 렌더 시점의 값이 아니라 직전 상태를 기준으로 바꿔, 빠르게 연달아 눌러도 앞선 선택을 잃지 않는다.
  function toggle(code) {
    if (import.meta.env.DEV && subtagsOn && current.includes(code)) {
      const ownCodes = (DUMMY_SUBTAGS[code] ?? []).map((sub) => sub.code)
      setSubPicked((prev) => prev.filter((subCode) => !ownCodes.includes(subCode)))
    }
    setPicked((prev) => {
      const base = prev ?? saved
      const next = base.includes(code) ? base.filter((item) => item !== code) : [...base, code]
      return next.length > max ? base : next
    })
  }

  function toggleSub(parentCode, subCode) {
    if (!import.meta.env.DEV) return // 배포 빌드에서는 이 함수와 더미 데이터가 번들에서 빠진다
    setSubPicked((prev) => {
      if (prev.includes(subCode)) return prev.filter((code) => code !== subCode)
      const ownCodes = (DUMMY_SUBTAGS[parentCode] ?? []).map((sub) => sub.code)
      if (prev.filter((code) => ownCodes.includes(code)).length >= SUBTAG_MAX_PER_PARENT) return prev
      return [...prev, subCode]
    })
  }

  async function handleNext() {
    if (!changed) {
      onDone()
      return
    }
    setSaving(true)
    try {
      await saveMyInterests({ taxonomyVersion: catalog.taxonomyVersion, interestCodes: current })
      onDone()
    } catch (err) {
      showToast(describeError(err, '관심 분야를 저장하지 못했어요.'), { icon: 'error' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="pt-16 px-space-md flex flex-col gap-1">
        <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">어떤 분야를 좋아해?</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          최대 {max}개까지 고를 수 있어요. 고르지 않아도 괜찮아요.
        </p>
      </div>

      {loading && <LoadingBlock label="관심 분야를 불러오는 중..." />}
      {!loading && error && <ErrorBlock message={error} onRetry={reload} />}
      {!loading && !error && !selectable && (
        <EmptyBlock icon="category" message="관심 분야를 준비 중이에요. 다음 단계로 넘어가 주세요." />
      )}
      {!loading && !error && selectable && (
        <div className="px-space-md mt-6 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2.5" role="group" aria-label="관심 분야">
            {items.map((item) => {
              const selected = current.includes(item.interestCode)
              const full = !selected && current.length >= max
              return (
                <button
                  key={item.interestCode}
                  type="button"
                  aria-pressed={selected}
                  disabled={full}
                  onClick={() => toggle(item.interestCode)}
                  className={`px-4 py-2.5 rounded-full font-label-md text-label-md font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                    selected ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container text-on-surface-variant'
                  }`}
                >
                  {item.name}
                </button>
              )
            })}
          </div>
          <span className="font-label-xs text-label-xs text-outline" aria-live="polite">
            {current.length}/{max}개 선택
          </span>

          {import.meta.env.DEV && subtagsOn && (
            <div className="flex flex-col gap-4 mt-2" data-testid="subtags">
              <p className="px-3 py-2 rounded-lg bg-surface-container font-label-xs text-label-xs text-on-surface-variant">
                실험용 화면이에요. 세부 태그는 더미 데이터이고 이 기기에만 저장돼요(서버에는 저장되지 않아요).
              </p>
              {current.map((parentCode) => {
                const parent = items.find((item) => item.interestCode === parentCode)
                const subs = DUMMY_SUBTAGS[parentCode] ?? []
                const ownCount = subs.filter((sub) => subPicked.includes(sub.code)).length
                return (
                  <section key={parentCode} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <h2 className="font-title-md text-title-md text-on-surface">{parent?.name} 세부 태그</h2>
                      <span className="font-label-xs text-label-xs text-outline">
                        {ownCount}/{SUBTAG_MAX_PER_PARENT}개
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2" role="group" aria-label={`${parent?.name} 세부 태그`}>
                      {subs.map((sub) => {
                        const selected = subPicked.includes(sub.code)
                        const full = !selected && ownCount >= SUBTAG_MAX_PER_PARENT
                        return (
                          <button
                            key={sub.code}
                            type="button"
                            aria-pressed={selected}
                            disabled={full}
                            onClick={() => toggleSub(parentCode, sub.code)}
                            className={`px-3.5 py-2 rounded-full font-label-sm text-label-sm font-semibold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                              selected ? 'bg-secondary text-on-secondary shadow-sm' : 'bg-surface-container-low text-on-surface-variant'
                            }`}
                          >
                            {sub.name}
                          </button>
                        )
                      })}
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </div>
      )}

      <OnboardingFooter>
        <PrimaryButton onClick={handleNext} disabled={saving || loading}>
          {saving ? '저장하는 중...' : current.length > 0 ? '다음' : '건너뛰기'}
        </PrimaryButton>
        {current.length > 0 && <GhostButton onClick={onDone} disabled={saving}>저장하지 않고 건너뛰기</GhostButton>}
      </OnboardingFooter>
    </>
  )
}

/**
 * 세부 태그 선택을 회원별로 보관하므로, 사용자 정보가 확정되면 안쪽 컴포넌트를 새로 만들어
 * 저장된 선택을 처음부터 올바른 키로 읽는다.
 */
export default function InterestStep(props) {
  const { user } = useUser()
  return <InterestStepContent key={user?.memberId ?? 'anonymous'} memberId={user?.memberId} {...props} />
}
