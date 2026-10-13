import test from 'node:test'
import assert from 'node:assert/strict'
import { isActivityNameLocked } from '../src/utils/activityName.js'

const NOW = Date.parse('2026-10-13T00:00:00Z')

test('마지막 변경 뒤 14일이 지나지 않아 변경 가능 시각이 미래이면 잠긴다', () => {
  assert.equal(isActivityNameLocked({ activityNameConfigured: true, activityNameChangeableAt: '2026-10-20T00:00:00Z' }, NOW), true)
})

test('변경 가능 시각이 지났거나 없으면(한 번도 안 바꿈) 잠기지 않는다', () => {
  assert.equal(isActivityNameLocked({ activityNameConfigured: true, activityNameChangeableAt: '2026-10-12T00:00:00Z' }, NOW), false)
  assert.equal(isActivityNameLocked({ activityNameConfigured: true, activityNameChangeableAt: null }, NOW), false)
})

test('아직 설정하지 않은 상태는 최초 설정이 즉시 가능해서 잠기지 않는다', () => {
  assert.equal(isActivityNameLocked({ activityNameConfigured: false, activityNameChangeableAt: '2026-10-20T00:00:00Z' }, NOW), false)
})

test('프로필이 없거나 시각 형식이 이상하면 잠그지 않는다', () => {
  assert.equal(isActivityNameLocked(null, NOW), false)
  assert.equal(isActivityNameLocked({ activityNameConfigured: true, activityNameChangeableAt: 'not a date' }, NOW), false)
})

test('시간대 표시가 없는 서버 시각도 UTC로 읽는다', () => {
  assert.equal(isActivityNameLocked({ activityNameConfigured: true, activityNameChangeableAt: '2026-10-20T00:00:00' }, NOW), true)
})
