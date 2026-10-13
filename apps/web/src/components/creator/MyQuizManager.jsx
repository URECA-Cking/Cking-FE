import { useEffect, useRef, useState } from 'react'
import MaterialIcon from '../ui/MaterialIcon.jsx'
import { EmptyBlock, ErrorBlock, LoadingBlock, StatusPill } from '../ui/States.jsx'
import QuizGenerationPanel from './QuizGenerationPanel.jsx'
import QuizRevisionSheet from './QuizRevisionSheet.jsx'
import { PUBLICATION_LABELS, REVIEW_LABELS } from './quizLabels.js'
import { useAsync } from '../../hooks/useAsync.js'
import { getMyQuizzes } from '../../api/creatorQuizzes.js'
import { formatDateTime } from '../../utils/format.js'
import { QUIZ_PAGE_SIZE, appendQuizPage, quizListView } from '../../utils/fanQuiz.js'
import { creatorQuizErrorMessage } from '../../utils/quizJobs.js'

/**
 * 내 스페이스 Quiz 탭의 Creator용 관리 화면. AI Quiz를 만들고(생성 요청·상태 조회), 내 Quiz 목록
 * (GET /api/creator/quizzes)에서 Quiz를 골라 문항 검토 → GPT Judge 평가 → 승인·반려 → 게시·게시 중지를 한다.
 * 팬이 보는 응시 화면은 CreatorQuizzes가 맡는다.
 */
export default function MyQuizManager({ creatorId }) {
  const [open, setOpen] = useState(null)
  const { data, loading, error, reload } = useAsync(
    () => getMyQuizzes({ page: 0, size: QUIZ_PAGE_SIZE }),
    [],
    { fallbackMessage: '내 Quiz를 불러오지 못했어요.' },
  )
  // "더 보기"로 이어 읽은 페이지. 첫 페이지를 다시 읽으면(data가 바뀌면) quizListView가 버린다.
  const [more, setMore] = useState(null)
  const [moreLoading, setMoreLoading] = useState(false)
  const [moreFailure, setMoreFailure] = useState(null)
  const moreError = moreFailure && moreFailure.base === data ? moreFailure.message : null
  const moreInFlight = useRef(false)
  const { items: quizzes, hasNext, nextPage } = quizListView(data, more)
  const latestData = useRef(data)
  useEffect(() => {
    latestData.current = data
  }, [data])

  async function loadMore() {
    if (moreInFlight.current || !data || !hasNext) return
    moreInFlight.current = true
    const base = data
    const page = nextPage
    setMoreLoading(true)
    setMoreFailure(null)
    try {
      const response = await getMyQuizzes({ page, size: QUIZ_PAGE_SIZE })
      setMore((current) => appendQuizPage(current, base, latestData.current, page, response))
    } catch (moreLoadError) {
      setMoreFailure({ base, message: creatorQuizErrorMessage(moreLoadError, 'Quiz를 더 불러오지 못했어요.') })
    } finally {
      moreInFlight.current = false
      setMoreLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-space-sm px-margin py-space-sm">
      <QuizGenerationPanel
        creatorId={creatorId}
        onSucceeded={reload}
        onReview={(job) => setOpen({ quizId: job.quizId, revisionId: job.revisionId })}
      />

      {loading && <LoadingBlock label="내 Quiz를 불러오는 중..." />}
      {!loading && error && <ErrorBlock message={error} onRetry={reload} />}
      {!loading && !error && quizzes.length === 0 && (
        <EmptyBlock icon="quiz" message="아직 만든 Quiz가 없어요. YouTube 영상으로 첫 Quiz를 만들어 보세요." />
      )}
      {!loading && !error && quizzes.map((quiz) => {
        const publication = PUBLICATION_LABELS[quiz.publicationStatus] ?? PUBLICATION_LABELS.NOT_PUBLISHED
        const review = REVIEW_LABELS[quiz.latestReviewStatus] ?? REVIEW_LABELS.PENDING_REVIEW
        return (
          <button
            key={quiz.quizId}
            type="button"
            onClick={() => setOpen({ quizId: quiz.quizId, revisionId: quiz.latestRevisionId })}
            className="flex items-center gap-space-md p-space-md rounded-xl bg-surface-container-low text-left active:scale-[0.99] transition-all"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-primary">
              <MaterialIcon name="quiz" className="text-[22px]" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="font-label-md text-label-md font-semibold text-on-surface truncate">{quiz.title}</span>
              <span className="flex flex-wrap items-center gap-1">
                <StatusPill label={publication.label} icon={publication.icon} tone={publication.tone} />
                <StatusPill label={review.label} icon={review.icon} tone={review.tone} />
              </span>
              <span className="font-label-xs text-label-xs text-on-surface-variant">
                revision {quiz.latestRevisionNo} · {formatDateTime(quiz.createdAt)} 생성
              </span>
            </span>
            <MaterialIcon name="chevron_right" className="text-[20px] text-outline" />
          </button>
        )
      })}
      {!loading && !error && moreError && <ErrorBlock message={moreError} onRetry={loadMore} />}
      {!loading && !error && hasNext && !moreError && (
        <button
          type="button"
          onClick={loadMore}
          disabled={moreLoading}
          className="self-center rounded-xl bg-surface-container px-4 py-2 font-label-sm text-label-sm font-semibold text-on-surface active:scale-95 transition-all disabled:opacity-60"
        >
          {moreLoading ? '불러오는 중...' : '더 보기'}
        </button>
      )}

      {open && (
        <QuizRevisionSheet
          key={`${open.quizId}:${open.revisionId}`}
          creatorId={creatorId}
          quizId={open.quizId}
          initialRevisionId={open.revisionId}
          onClose={() => setOpen(null)}
          onChanged={reload}
        />
      )}
    </div>
  )
}
