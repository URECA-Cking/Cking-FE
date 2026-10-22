import { ApiError, apiClient } from './client';

// Fan Quiz API. 계약 정본: Cking-BE docs/domains/quiz/api.md, docs/domains/quiz/attempt-api.md

/** GET /api/creators/{creatorId}/quizzes - 게시 중인 Quiz 목록(공개, 최근 게시 순) */
export async function getCreatorQuizzes(creatorId, { page = 0, size = 20 } = {}) {
  return apiClient.get(`/api/creators/${creatorId}/quizzes`, { page, size });
}

/** GET /api/creators/{creatorId}/quizzes/{quizId} - 게시 revision의 문항·보기(공개, 정답·해설 없음) */
export async function getCreatorQuiz(creatorId, quizId) {
  return apiClient.get(`/api/creators/${creatorId}/quizzes/${quizId}`);
}

/**
 * POST /api/creators/{creatorId}/quizzes/{quizId}/attempts - 답안 제출과 서버 채점(로그인 필요).
 * 같은 requestId·같은 답안의 재전송은 저장된 결과를 그대로 돌려주므로, 응답을 못 받은 재시도에는 같은 requestId를 쓴다.
 */
export async function submitQuizAttempt(creatorId, quizId, { requestId, revisionId, answers }) {
  return apiClient.post(`/api/creators/${creatorId}/quizzes/${quizId}/attempts`, { requestId, revisionId, answers });
}

/** GET /api/creators/{creatorId}/quizzes/{quizId}/my-attempt - 본인 응시 결과(로그인 필요). 응시 기록이 없으면 null */
export async function getMyQuizAttempt(creatorId, quizId) {
  try {
    return await apiClient.get(`/api/creators/${creatorId}/quizzes/${quizId}/my-attempt`);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'QUIZ_ATTEMPT_NOT_FOUND') return null;
    throw error;
  }
}
