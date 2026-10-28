import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'
// 이벤트 생성·수정 화면의 배너(Cking-BE #748, FE #401): 올린 배너만 bannerImageKey로 보내고, 수정에서 건드리지 않으면 보내지 않으며, 지우면 null을 보낸다.
let browser, bundle, css
const pageErrors = []

test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('http://event.test'), 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/eventPrizeKeysBrowser.jsx', import.meta.url)), name: 'EventBannerForm', formats: ['iife'] } },
  })
  const parts = (Array.isArray(output) ? output[0] : output).output
  bundle = parts.find((part) => part.type === 'chunk').code
  css = parts.filter((part) => part.type === 'asset' && part.fileName.endsWith('.css')).map((part) => part.source).join('\n')
  const paths = [process.env.UI_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => { await browser?.close(); assert.deepEqual(pageErrors, []) })

const prizes = [{ prizeKey: 'FIRST', displayName: '1등', priority: 1, weight: 100, quantity: 1 }]

/** 생성(edit=false) 또는 기존 배너가 있는(bannerImageUrl) 이벤트 수정 화면을 모의 API로 연다. */
async function screen({ edit = false, bannerImageUrl = null, uploadError = null } = {}) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }) : route.abort())
  await page.goto('http://localhost/event-banner-form')
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 600; canvas.height = 200
    canvas.getContext('2d').fillRect(0, 0, 600, 200)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  await page.route('https://images.test/**', (route) => route.fulfill({ contentType: 'image/png', body: Buffer.from(png, 'base64') }))
  await page.evaluate(({ edit, bannerImageUrl, uploadError, prizes }) => {
    window.eventPath = edit ? '/creator/events/16/edit' : '/creator/events/new'
    window.calls = []; window.toasts = []; window.uploadError = uploadError; window.createError = null
    window.fetch = async (url, options = {}) => {
      const path = new URL(url).pathname, method = options.method ?? 'GET'
      // 예약 API가 없는 환경(404)처럼 두어 기존 업로드 경로를 검증한다(FE #445)
      if (path === '/api/uploads') return new Response(JSON.stringify({ code: 'RESOURCE_NOT_FOUND', data: null, message: null }), { status: 404 })
      window.calls.push({ path, method, body: typeof options.body === 'string' ? JSON.parse(options.body) : options.body ? 'form' : undefined })
      const response = (data, status = 200, code = 'SUCCESS') => new Response(JSON.stringify({ code, data, message: code }), { status })
      if (path === '/api/creator/events/banner-images') {
        return window.uploadError ? response(null, 400, window.uploadError) : response({ imageKey: 'creator-space-profile-images/1/event-banner/new.jpg' }, 201)
      }
      if (path === '/api/creator/space') return response(null)
      if (path === '/api/creator/events' && method === 'GET') {
        return response({ items: [{ eventId: 16, title: '기존 이벤트', description: '', drawMethod: 'WEIGHTED', prizeAlgorithmVersion: 'PRIZE_WEIGHTED_V1',
          winnerCount: 1, startAt: '2030-01-01T01:00:00Z', endAt: '2030-02-01T01:00:00Z', prizes, bannerImageKey: bannerImageUrl ? 'old' : null, bannerImageUrl }], hasNext: false })
      }
      if (path === '/api/creator/events' && method === 'POST') {
        return window.createError ? response(null, 409, window.createError) : response({ eventId: 16, status: 'DRAFT' }, 201)
      }
      if (path === '/api/creator/events/16' && method === 'PATCH') return response({ eventId: 16, status: 'DRAFT' })
      throw Error(path)
    }
  }, { edit, bannerImageUrl, uploadError, prizes })
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: bundle })
  await page.getByRole('textbox', { name: '상품 1 이름', exact: true }).waitFor()
  if (!edit) {
    await page.getByRole('textbox', { name: '제목', exact: false }).fill('새 이벤트')
    for (const [name, value] of [['순위', '1'], ['가중치', '100'], ['수량', '1']]) {
      await page.getByRole('spinbutton', { name: `상품 1 ${name}`, exact: true }).fill(value)
    }
  }
  return { page, png }
}

async function pickBanner(page, png) {
  await page.getByLabel('배너 이미지 파일').setInputFiles({ name: 'banner.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
  await page.waitForFunction(() => window.calls.some((call) => call.path === '/api/creator/events/banner-images'))
  await page.waitForFunction(() => !document.querySelector('[aria-label="배너 이미지 변경"][disabled], [aria-label="배너 이미지 선택"][disabled]'))
}

const writes = (page) => page.evaluate(() => window.calls.filter((call) => (call.method === 'POST' || call.method === 'PATCH') && call.body !== 'form'))
async function save(page, edit) {
  await page.getByRole('button', { name: edit ? '수정 저장' : '이벤트 초안 작성', exact: true }).click()
  await page.waitForFunction(() => window.calls.some((call) => (call.method === 'POST' || call.method === 'PATCH') && call.body !== 'form'))
}

test('새 이벤트는 배너를 올리지 않으면 bannerImageKey를 보내지 않고, 올리면 받은 key를 보낸다', async () => {
  for (const withBanner of [false, true]) {
    const { page, png } = await screen()
    try {
      assert.equal(await page.getByRole('img', { name: '배너 미리보기' }).count(), 0)
      if (withBanner) {
        await pickBanner(page, png)
        assert.equal(await page.getByRole('img', { name: '배너 미리보기' }).count(), 1)
      }
      await save(page, false)
      const [request] = await writes(page)
      assert.equal(request.path, '/api/creator/events')
      if (withBanner) assert.equal(request.body.bannerImageKey, 'creator-space-profile-images/1/event-banner/new.jpg')
      else assert.equal('bannerImageKey' in request.body, false)
    } finally { await page.close() }
  }
})

test('수정에서 배너를 건드리지 않으면 bannerImageKey 없이 저장해 기존 배너를 유지한다', async () => {
  const { page } = await screen({ edit: true, bannerImageUrl: 'https://images.test/banner-old.png' })
  try {
    assert.equal(await page.getByRole('img', { name: '배너 미리보기' }).getAttribute('src'), 'https://images.test/banner-old.png')
    await save(page, true)
    const [request] = await writes(page)
    assert.equal(request.method, 'PATCH')
    assert.equal('bannerImageKey' in request.body, false)
  } finally { await page.close() }
})

test('수정에서 배너를 지우면 null을, 새로 올리면 새 key를 보낸다', async () => {
  for (const action of ['remove', 'replace']) {
    const { page, png } = await screen({ edit: true, bannerImageUrl: 'https://images.test/banner-old.png' })
    try {
      if (action === 'remove') {
        await page.getByRole('button', { name: '배너 지우기', exact: true }).click()
        assert.equal(await page.getByRole('img', { name: '배너 미리보기' }).count(), 0)
        await page.getByText('저장하면 배너가 지워져요').waitFor()
      } else {
        await pickBanner(page, png)
      }
      await save(page, true)
      const [request] = await writes(page)
      assert.equal(request.body.bannerImageKey, action === 'remove' ? null : 'creator-space-profile-images/1/event-banner/new.jpg')
    } finally { await page.close() }
  }
})

test('지우기를 취소하면 기존 배너를 다시 보여 주고 bannerImageKey를 보내지 않는다', async () => {
  const { page } = await screen({ edit: true, bannerImageUrl: 'https://images.test/banner-old.png' })
  try {
    await page.getByRole('button', { name: '배너 지우기', exact: true }).click()
    await page.getByRole('button', { name: '지우기 취소', exact: true }).click()
    assert.equal(await page.getByRole('img', { name: '배너 미리보기' }).getAttribute('src'), 'https://images.test/banner-old.png')
    await save(page, true)
    const [request] = await writes(page)
    assert.equal('bannerImageKey' in request.body, false)
  } finally { await page.close() }
})

test('저장된 배너 위에 새 배너를 올렸다가 변경 취소하면 저장된 배너가 그대로 남는다', async () => {
  const { page, png } = await screen({ edit: true, bannerImageUrl: 'https://images.test/banner-old.png' })
  try {
    await pickBanner(page, png)
    assert.equal(await page.getByRole('button', { name: '배너 지우기', exact: true }).count(), 0)
    await page.getByRole('button', { name: '변경 취소', exact: true }).click()
    assert.equal(await page.getByRole('img', { name: '배너 미리보기' }).getAttribute('src'), 'https://images.test/banner-old.png')
    await save(page, true)
    const [request] = await writes(page)
    assert.equal('bannerImageKey' in request.body, false)
  } finally { await page.close() }
})

test('올린 배너를 선택 취소하면 그 전 업로드 실패 문구도 함께 사라진다', async () => {
  const { page, png } = await screen()
  try {
    await pickBanner(page, png)
    await page.evaluate(() => { window.uploadError = 'INVALID_EVENT_BANNER_IMAGE' })
    await page.getByLabel('배너 이미지 파일').setInputFiles({ name: 'b.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
    await page.getByRole('alert').filter({ hasText: '배너 이미지를 사용할 수 없어요' }).waitFor()
    await page.getByRole('button', { name: '선택 취소', exact: true }).click()
    assert.equal(await page.getByRole('alert').filter({ hasText: '배너 이미지를 사용할 수 없어요' }).count(), 0)
    assert.equal(await page.getByRole('img', { name: '배너 미리보기' }).count(), 0)
  } finally { await page.close() }
})

test('같은 요청이 이미 저장돼 IDEMPOTENCY_CONFLICT가 오면 내 이벤트 목록에서 확인하라고 안내한다', async () => {
  const { page } = await screen()
  try {
    await page.evaluate(() => { window.createError = 'IDEMPOTENCY_CONFLICT' })
    await save(page, false)
    await page.getByText('이 이벤트는 이미 저장됐을 수 있어요. 내 이벤트 목록에서 확인한 뒤 필요하면 수정해주세요.').waitFor()
  } finally { await page.close() }
})

test('업로드가 거절되면 배너 안내 문구를 보여 주고 배너 없이 저장한다', async () => {
  const { page, png } = await screen({ uploadError: 'INVALID_EVENT_BANNER_IMAGE' })
  try {
    await page.getByLabel('배너 이미지 파일').setInputFiles({ name: 'banner.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
    await page.getByRole('alert').filter({ hasText: '배너 이미지를 사용할 수 없어요' }).waitFor()
    assert.equal(await page.getByRole('img', { name: '배너 미리보기' }).count(), 0)
    await save(page, false)
    const [request] = await writes(page)
    assert.equal('bannerImageKey' in request.body, false)
  } finally { await page.close() }
})
