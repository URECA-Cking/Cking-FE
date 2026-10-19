import { apiClient } from './client';

// Creator AI Quiz 관리 API(Creator JWT 필수). 계약 정본: Cking-BE docs/domains/quiz/api.md, docs/domains/quiz/judge-api.md

/** GET /api/creator/quizzes - 내 Quiz 목록(최근 생성 순). 제목·검토 상태는 최신 revision 기준 */
export async function getMyQuizzes({ page = 0, size = 20 } = {}) {
  return apiClient.get('/api/creator/quizzes', { page, size });
}

/** GET /api/creator/quizzes/{quizId} - 내 Quiz 상세와 revision 목록(번호 오름차순) */
export async function getMyQuiz(quizId) {
  return apiClient.get(`/api/creator/quizzes/${quizId}`);
}

/** GET /api/creator/quizzes/{quizId}/revisions/{revisionId} - 검토용 revision(정답·해설·근거·원본 텍스트 포함) */
export async function getMyQuizRevision(quizId, revisionId) {
  return apiClient.get(`/api/creator/quizzes/${quizId}/revisions/${revisionId}`);
}

/**
 * POST /api/creator/quizzes/generations - YouTube 영상으로 Quiz 생성 요청(202, 비동기).
 * 같은 requestId·같은 입력(videoId·제목·문항 수)의 재요청은 기존 작업을 돌려준다.
 */
export async function requestQuizGeneration({ requestId, youtubeUrl, title, questionCount }) {
  return apiClient.post('/api/creator/quizzes/generations', { requestId, youtubeUrl, title, questionCount });
}

/** GET /api/creator/quizzes/generations/{generationId} - 생성 작업 상태 */
export async function getQuizGeneration(generationId) {
  return apiClient.get(`/api/creator/quizzes/generations/${generationId}`);
}

/**
 * POST /api/creator/quizzes/{quizId}/revisions/{revisionId}/judge-evaluations - GPT Judge 평가 요청(202, 비동기).
 * 같은 requestId·같은 대상의 재요청은 기존 Job을 돌려주며 다시 실행하지 않는다.
 */
export async function requestJudgeEvaluation(quizId, revisionId, { requestId }) {
  return apiClient.post(`/api/creator/quizzes/${quizId}/revisions/${revisionId}/judge-evaluations`, { requestId });
}

/** GET .../judge-evaluations/{evaluationId} - 평가 Job 상태와 결과. Provider 실패도 200과 failureCode로 온다 */
export async function getJudgeEvaluation(quizId, revisionId, evaluationId) {
  return apiClient.get(`/api/creator/quizzes/${quizId}/revisions/${revisionId}/judge-evaluations/${evaluationId}`);
}

/** POST .../revisions/{revisionId}/approve - 승인(본문 없음). 이미 승인했으면 기존 결정을 돌려준다 */
export async function approveQuizRevision(quizId, revisionId) {
  return apiClient.post(`/api/creator/quizzes/${quizId}/revisions/${revisionId}/approve`);
}

/** POST .../revisions/{revisionId}/reject - 반려(사유 선택, 500자 이하). 이미 반려했으면 기존 결정을 돌려준다 */
export async function rejectQuizRevision(quizId, revisionId, reason) {
  return apiClient.post(`/api/creator/quizzes/${quizId}/revisions/${revisionId}/reject`, reason ? { reason } : undefined);
}

/** POST /api/creator/quizzes/{quizId}/publish - 승인된 최신 revision 게시 */
export async function publishQuiz(quizId, revisionId) {
  return apiClient.post(`/api/creator/quizzes/${quizId}/publish`, { revisionId });
}

/** POST /api/creator/quizzes/{quizId}/unpublish - 게시 중지(본문 없음) */
export async function unpublishQuiz(quizId) {
  return apiClient.post(`/api/creator/quizzes/${quizId}/unpublish`);
}

/** POST /api/creator/quizzes/{quizId}/revisions — 신규 201 / replay 200 모두 Revision을 반환한다. */
export async function composeQuizRevision(quizId, body) {
  return apiClient.post(`/api/creator/quizzes/${quizId}/revisions`, body);
}

/** 기존 Judge 승인과 분리된 Creator 책임 승인. 서버가 반환한 최종 hash를 사용한다. */
export async function approveQuizByCreator(quizId, revisionId, revisionSha256) {
  return apiClient.post(`/api/creator/quizzes/${quizId}/revisions/${revisionId}/creator-approval`, {
    revisionSha256, acknowledgeResponsibility: true,
  });
}

/** 진행 중 작업이 없으면 null 또는 undefined가 반환될 수 있다. */
export async function getCurrentQuizGeneration() {
  return apiClient.get('/api/creator/quizzes/generations/current');
}
export async function confirmQuizContent(generationId, contentText) {
  return apiClient.post(`/api/creator/quizzes/generations/${generationId}/content-confirmation`, { contentText });
}
export async function cancelQuizGeneration(generationId) {
  return apiClient.post(`/api/creator/quizzes/generations/${generationId}/cancel`);
}

/** POST /api/creator/quizzes/{quizId}/close — 영구 마감(본문 없음), 반복 요청도 현재 상태를 반환한다. */
export async function closeQuiz(quizId) {
  return apiClient.post(`/api/creator/quizzes/${quizId}/close`);
}
