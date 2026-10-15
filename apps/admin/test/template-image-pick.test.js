import test from 'node:test'
import assert from 'node:assert/strict'
import { pickTemplateImage } from '../src/utils/templateImagePick.js'

const file = (name) => ({ name, type: 'image/png', size: 1 })

/** 검증·업로드가 끝나는 시점을 테스트가 정하도록 미루는 promise. */
function deferred() {
  let resolve
  let reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

/** 호출 순서를 모으는 화면 대역. busy는 폼이 저장을 막는 값(처리 중인 칸 수가 0이 아니면 true)이다. */
function harness(overrides = {}) {
  const lock = { current: false }
  const events = []
  const state = { busy: false, message: null, uploaded: [] }
  const deps = {
    validate: async () => null,
    upload: async (picked) => ({ imageUrl: `https://cdn.example.com/${picked.name}` }),
    describeError: (error) => `오류: ${error.message}`,
    onBusyChange: (busy) => { state.busy = busy; events.push(`busy:${busy}`) },
    onMessage: (message) => { state.message = message; events.push(`message:${message}`) },
    onUploaded: (picked, imageUrl) => { state.uploaded.push([picked.name, imageUrl]); events.push(`uploaded:${imageUrl}`) },
    ...overrides,
  }
  return { lock, events, state, deps }
}

test('파일을 고른 직후, 검증이 끝나기 전에 이미 처리 중이라 저장할 수 없다', async () => {
  const validation = deferred()
  const { lock, state, deps } = harness({ validate: () => validation.promise })
  const picking = pickTemplateImage(file('a.png'), lock, deps)
  // 이미지 크기 읽기(검증)가 아직 끝나지 않았다. 이 시점에 저장하면 이전 URL이 저장되므로 이미 처리 중이어야 한다.
  assert.equal(state.busy, true)
  assert.equal(lock.current, true)
  assert.deepEqual(state.uploaded, [])
  validation.resolve(null)
  assert.equal(await picking, true)
  assert.equal(state.busy, false)
  assert.equal(lock.current, false)
  assert.deepEqual(state.uploaded, [['a.png', 'https://cdn.example.com/a.png']])
})

test('처리 중에 연달아 고른 파일은 무시해서 먼저 고른 파일의 결과가 덮이지 않는다', async () => {
  const validation = deferred()
  const uploads = []
  const { lock, state, deps } = harness({
    validate: () => validation.promise,
    upload: async (picked) => { uploads.push(picked.name); return { imageUrl: `https://cdn.example.com/${picked.name}` } },
  })
  const first = pickTemplateImage(file('first.png'), lock, deps)
  assert.equal(await pickTemplateImage(file('second.png'), lock, deps), false)
  validation.resolve(null)
  await first
  assert.deepEqual(uploads, ['first.png'])
  assert.deepEqual(state.uploaded, [['first.png', 'https://cdn.example.com/first.png']])
})

test('처리가 끝나면 다시 고를 수 있다', async () => {
  const { lock, state, deps } = harness()
  await pickTemplateImage(file('a.png'), lock, deps)
  await pickTemplateImage(file('b.png'), lock, deps)
  assert.deepEqual(state.uploaded.map(([name]) => name), ['a.png', 'b.png'])
})

test('검증에서 거절하면 업로드하지 않고 안내만 보이며 처리 중이 풀린다', async () => {
  const uploads = []
  const { lock, state, deps } = harness({
    validate: async () => '이미지는 600×200px 이상이어야 해요.',
    upload: async (picked) => { uploads.push(picked.name) },
  })
  await pickTemplateImage(file('small.png'), lock, deps)
  assert.deepEqual(uploads, [])
  assert.deepEqual(state.uploaded, [])
  assert.equal(state.message, '이미지는 600×200px 이상이어야 해요.')
  assert.equal(state.busy, false)
  assert.equal(lock.current, false)
})

test('업로드가 실패하면 값을 바꾸지 않고 오류 문구를 보이며 처리 중이 풀린다', async () => {
  const { lock, state, deps } = harness({ upload: async () => { throw new Error('서버 오류') } })
  await pickTemplateImage(file('a.png'), lock, deps)
  assert.deepEqual(state.uploaded, [])
  assert.equal(state.message, '오류: 서버 오류')
  assert.equal(state.busy, false)
  assert.equal(lock.current, false)
})

test('응답에 imageUrl이 없으면 값을 바꾸지 않고 실패로 처리한다', async () => {
  const { lock, state, deps } = harness({ upload: async () => ({}) })
  await pickTemplateImage(file('a.png'), lock, deps)
  assert.deepEqual(state.uploaded, [])
  assert.match(state.message, /이미지 주소를 받지 못했습니다/)
  assert.equal(state.busy, false)
})

test('처리 중 알림은 검증 전에 켜지고 끝에서 꺼지며, 시작할 때 이전 안내 문구를 지운다', async () => {
  const { lock, events, deps } = harness()
  await pickTemplateImage(file('a.png'), lock, deps)
  assert.deepEqual(events, ['busy:true', 'message:', 'uploaded:https://cdn.example.com/a.png', 'busy:false'])
})

test('파일이 없으면 아무것도 하지 않는다', async () => {
  const { lock, events, deps } = harness()
  assert.equal(await pickTemplateImage(undefined, lock, deps), false)
  assert.deepEqual(events, [])
})
