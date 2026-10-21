import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const script = html.match(/<script>((?:(?!<\/script>)[\s\S])*icons-outlined-ready(?:(?!<\/script>)[\s\S])*)<\/script>/)[1]

const OUTLINED = 'Material Symbols Outlined'
const ROUNDED = 'Material Symbols Rounded'

// index.html의 폰트 감지 스크립트를 가짜 document.fonts와 가짜 타이머로 실행한다.
function run({ faces, fonts = {} }) {
  const classes = new Set()
  const listeners = {}
  const timers = []
  let now = 0
  const resolved = Promise.resolve()
  const document = {
    documentElement: { classList: { add: (...names) => names.forEach((name) => classes.add(name)) } },
    fonts: {
      forEach: (callback) => faces.forEach(callback),
      addEventListener: (type, listener) => { listeners[type] = listener },
      load: () => resolved,
      ready: resolved,
      ...fonts,
    },
  }
  const context = {
    document,
    setInterval: (callback, delay) => timers.push({ callback, delay, next: now + delay, repeat: true }),
    setTimeout: (callback, delay) => timers.push({ callback, delay, next: now + delay, repeat: false }),
    clearInterval: (id) => { timers[id - 1].cancelled = true },
  }
  vm.runInNewContext(script, context)
  return {
    classes,
    fireLoadingDone: () => listeners.loadingdone?.(),
    async advance(ms) {
      const end = now + ms
      for (;;) {
        const due = timers.filter((timer) => !timer.cancelled && timer.next <= end).sort((a, b) => a.next - b.next)[0]
        if (!due) break
        now = due.next
        if (due.repeat) due.next += due.delay
        else due.cancelled = true
        due.callback()
      }
      now = end
      await resolved
    },
  }
}

test('폰트가 이미 받아졌으면 바로 아이콘 숨김을 푼다', () => {
  const { classes } = run({ faces: [{ family: `"${OUTLINED}"`, status: 'loaded' }, { family: ROUNDED, status: 'loaded' }] })
  assert.deepEqual([...classes].sort(), ['icons-outlined-ready', 'icons-rounded-ready'])
})

test('iOS처럼 loadingdone이 오지 않아도 뒤늦게 받아진 폰트는 주기 확인으로 숨김을 푼다', async () => {
  const outlined = { family: OUTLINED, status: 'loading' }
  const rounded = { family: ROUNDED, status: 'unloaded' }
  const page = run({ faces: [outlined, rounded] })
  assert.equal(page.classes.size, 0)
  outlined.status = 'loaded'
  await page.advance(300)
  assert.deepEqual([...page.classes], ['icons-outlined-ready'])
  rounded.status = 'loaded'
  await page.advance(300)
  assert.deepEqual([...page.classes].sort(), ['icons-outlined-ready', 'icons-rounded-ready'])
})

test('폰트가 10초 넘게 받아지지 않아도 아이콘 이름 글자가 보이지 않게 숨김을 유지한다', async () => {
  const page = run({ faces: [{ family: OUTLINED, status: 'loading' }, { family: ROUNDED, status: 'unloaded' }] })
  await page.advance(11000)
  assert.equal(page.classes.size, 0)
})

test('폰트 로드가 실패해도 숨김을 유지한다', async () => {
  const page = run({
    faces: [{ family: OUTLINED, status: 'error' }, { family: ROUNDED, status: 'error' }],
    fonts: { load: () => Promise.reject(new Error('network')) },
  })
  await page.advance(11000)
  assert.equal(page.classes.size, 0)
})

test('10초 뒤에 뒤늦게 받아진 폰트는 loadingdone으로 숨김을 푼다', async () => {
  const outlined = { family: OUTLINED, status: 'loading' }
  const page = run({ faces: [outlined] })
  await page.advance(11000)
  assert.equal(page.classes.size, 0)
  outlined.status = 'loaded'
  page.fireLoadingDone()
  assert.deepEqual([...page.classes], ['icons-outlined-ready'])
})

test('폰트 로딩 상태를 알 수 없는 브라우저에서는 아이콘을 숨기지 않는다', () => {
  const page = run({ faces: [], fonts: { forEach: undefined } })
  assert.deepEqual([...page.classes].sort(), ['icons-outlined-ready', 'icons-rounded-ready'])
})
