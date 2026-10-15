import assert from 'node:assert/strict'
import test from 'node:test'

import { guideHiddenKey, readGuideHidden, writeGuideHidden } from '../src/utils/welcomeGuide.js'

/** 브라우저 저장소를 흉내 낸 메모리 저장소. */
function memoryStorage() {
  const values = new Map()
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  }
}

/** 접근할 때마다 오류를 던지는 저장소(비공개 창·차단 설정). */
const blockedStorage = {
  getItem() { throw new Error('blocked') },
  setItem() { throw new Error('blocked') },
  removeItem() { throw new Error('blocked') },
}

test('저장 키에 회원 번호가 들어가 계정이 바뀌어도 숨김 상태가 섞이지 않는다', () => {
  assert.notEqual(guideHiddenKey(1), guideHiddenKey(2))
  const storage = memoryStorage()
  writeGuideHidden(1, true, storage)
  assert.equal(readGuideHidden(1, storage), true)
  assert.equal(readGuideHidden(2, storage), false)
})

test('숨김을 해제하면 저장된 값이 지워진다', () => {
  const storage = memoryStorage()
  writeGuideHidden(1, true, storage)
  writeGuideHidden(1, false, storage)
  assert.equal(readGuideHidden(1, storage), false)
  assert.equal(storage.getItem(guideHiddenKey(1)), null)
})

test('저장소를 쓸 수 없으면 보이는 상태로 읽고 저장은 오류 없이 넘어간다', () => {
  assert.equal(readGuideHidden(1, blockedStorage), false)
  assert.doesNotThrow(() => writeGuideHidden(1, true, blockedStorage))
  assert.equal(readGuideHidden(1, null), false)
  assert.doesNotThrow(() => writeGuideHidden(1, true, null))
})

test('회원이 없으면 읽지도 쓰지도 않는다', () => {
  const storage = memoryStorage()
  writeGuideHidden(null, true, storage)
  assert.equal(readGuideHidden(null, storage), false)
  assert.equal(storage.getItem(guideHiddenKey(null)), null)
})
