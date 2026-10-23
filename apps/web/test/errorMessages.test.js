import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ApiError } from '@cking/shared/api'
import { COMMON_ERROR_MESSAGES, DEFAULT_ERROR_MESSAGE, describeError } from '../src/api/errorMessages.js'

test('서버 message는 화면 문구로 쓰지 않고 대체 문구를 쓴다', () => {
  assert.equal(describeError(new ApiError('SYSTEM_ERROR', '서버 오류가 발생했습니다.', 500), '기본'), '기본')
  assert.equal(describeError(new ApiError('INVALID_REFRESH_TOKEN', 'Refresh Token이 유효하지 않습니다.', 401), '기본'), '기본')
  assert.equal(describeError(new ApiError(undefined, undefined, 502), '기본'), '기본')
  assert.equal(describeError(new ApiError('toString', '서버 메시지', 500), '기본'), '기본')
  assert.equal(describeError(new TypeError('Failed to fetch'), '기본'), '기본')
  assert.equal(describeError(new ApiError('SOMETHING_NEW', '서버 메시지', 409)), DEFAULT_ERROR_MESSAGE)
})

test('공통 표에 있는 코드는 화면과 관계없이 FE 문구를 쓴다', () => {
  assert.equal(describeError(new ApiError('NETWORK_ERROR', '연결 실패'), '기본'), COMMON_ERROR_MESSAGES.NETWORK_ERROR)
  assert.equal(describeError(new ApiError('DUPLICATE_MISSION', '해당 기간에 이미 완료한 미션입니다.', 409), '기본'), '이미 완료한 미션이에요.')
  assert.equal(describeError(new ApiError('FORBIDDEN', '권한이 없습니다.', 403), '기본'), COMMON_ERROR_MESSAGES.FORBIDDEN)
})

test('공통 문구에는 서버 이름이나 내부 용어가 없다', () => {
  for (const message of Object.values(COMMON_ERROR_MESSAGES)) {
    assert.doesNotMatch(message, /백엔드|Cking-BE|\bAPI\b|requestId|요청번호|Redis|hash|UUID/i)
  }
})

// 서버 message(오류 객체·응답 봉투의 message)를 화면에 넘기는 코드가 다시 생기지 않게 막는다.
// 화면 문구는 errorMessages.js·화면별 코드 표·대체 문구로만 정한다.
const SRC = fileURLToPath(new URL('../src', import.meta.url))
const SERVER_MESSAGE = /\b(error|err|e|failure|exception|envelope|response|res|payload)\??\.message\b/
// 화면에 쓰지 않는 사용처. 새로 추가할 때는 화면에 나가지 않는 이유를 적는다.
const ALLOWED = [
  // 응답 봉투를 오류 객체로 옮길 뿐 화면에 쓰지 않는다.
  ['api/client.js', 'new ApiError(envelope.code, envelope.message, envelope.status)'],
  ['api/missions.js', 'new ApiError(response.code, response.message, response.status)'],
  // 해제 시각만 읽고, 문구는 sanctionNotice.js의 FE 문구를 쓴다.
  ['components/creator/PostComments.jsx', 'describeCommentRestriction(error.code, error.message)'],
  // FE가 던진 검증 오류(quizComposition.js·저장소 읽기 실패)의 문구다.
  ['components/creator/QuizCompositionPanel.jsx', 'catch (e) { setError(e.message); return }'],
  // allocatePrizeKey가 던지는 FE 문구다.
  ['pages/CreatorEventForm.jsx', 'setFormError(error.message)'],
]

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'dev' ? [] : sourceFiles(full)
    return /\.(js|jsx)$/.test(entry.name) ? [full] : []
  })
}

test('서버 message를 화면에 넘기는 코드가 없다', () => {
  const found = []
  for (const file of sourceFiles(SRC)) {
    const relative = path.relative(SRC, file).split(path.sep).join('/')
    fs.readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
      if (!SERVER_MESSAGE.test(line)) return
      if (ALLOWED.some(([allowedFile, snippet]) => allowedFile === relative && line.includes(snippet))) return
      found.push(`${relative}:${index + 1}: ${line.trim()}`)
    })
  }
  assert.deepEqual(found, [])
})
