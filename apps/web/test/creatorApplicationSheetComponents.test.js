import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'

let browser, bundle
test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent', define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('http://application.test'), 'process.env.NODE_ENV': JSON.stringify('production') }, build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/creatorApplicationBrowser.jsx', import.meta.url)), name: 'CreatorApplicationTest', formats: ['iife'] } } })
  bundle = (Array.isArray(output) ? output[0] : output).output.find((part) => part.type === 'chunk').code
  const paths = [process.env.UI_TEST_BROWSER, '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => { await browser?.close() })

const savedForm = { preferredActivityName: '기존 활동명', categoryCodes: ['OLD', 'FOOD'], introduction: '소개입니다. '.repeat(6), evidenceUrls: ['https://example.com/creator'], activityPlan: '앞으로 팬들과 정기적인 콘텐츠를 공유하고 이벤트를 운영하겠습니다. '.repeat(2), platforms: ['YOUTUBE'], agreeToCreatorPolicy: true }

async function screen(revising) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  await page.route('**/*', (route) => route.request().isNavigationRequest() ? route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }) : route.abort())
  await page.goto('http://localhost/application')
  await page.evaluate(({ revising, savedForm }) => {
    window.application = revising ? { applicationId: 9, status: 'NEEDS_REVISION' } : null
    window.calls = []
    window.toasts = []
    window.done = false
    window.fetch = async (url, options = {}) => {
      const path = new URL(String(url), location.href).pathname
      const method = options.method ?? 'GET'
      window.calls.push({ path, method, body: options.body ? JSON.parse(options.body) : null })
      const data = path === '/api/interests' ? { taxonomyVersion: 'v2', items: [{ interestCode: 'FOOD', name: '요리' }] }
        : path === '/api/creator/applications/9' ? { applicationId: 9, status: 'NEEDS_REVISION', submissionVersion: 1, revisionReason: '증빙을 보완해 주세요.', submittedForm: savedForm }
          : { applicationId: 9, status: method === 'POST' && path.endsWith('resubmit') ? 'PENDING' : 'NEEDS_REVISION' }
      return new Response(JSON.stringify({ code: 'SUCCESS', data }), { status: 200 })
    }
  }, { revising, savedForm })
  await page.addScriptTag({ content: bundle })
  await page.getByRole('dialog').waitFor()
  await page.getByRole('textbox', { name: '희망 활동명' }).waitFor()
  return page
}

test('새 신청서는 활동 분야와 증빙 URL을 포함한 전체 Form을 제출한다', async () => {
  const page = await screen(false)
  try {
    await page.getByRole('textbox', { name: '희망 활동명' }).fill('새 활동명')
    await page.getByRole('button', { name: '요리' }).click()
    await page.getByRole('textbox', { name: /소개/ }).fill('팬들과 요리 콘텐츠를 제작하고 소통하는 크리에이터입니다.')
    await page.getByRole('textbox', { name: '증빙 URL 1' }).fill('https://example.com/creator')
    await page.getByRole('textbox', { name: /활동 계획/ }).fill('매주 새로운 콘텐츠를 만들고 팬들과 함께하는 요리 이벤트를 정기적으로 열겠습니다. 다양한 레시피도 소개할 예정입니다.')
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: '크리에이터 전환 신청하기' }).click()
    await page.waitForFunction(() => window.done)
    const calls = await page.evaluate(() => window.calls)
    const submitted = calls.find((call) => call.path === '/api/creator/applications' && call.method === 'POST')
    assert.deepEqual(submitted.body.categoryCodes, ['FOOD'])
    assert.deepEqual(submitted.body.evidenceUrls, ['https://example.com/creator'])
    assert.equal(submitted.body.agreeToCreatorPolicy, true)
  } finally { await page.close() }
})

test('보완 신청서는 비활성 분야를 선택 수에서 빼고 PATCH 후 재제출한다', async () => {
  const page = await screen(true)
  try {
    assert.match(await page.getByRole('dialog').innerText(), /보완 요청: 증빙을 보완해 주세요/)
    assert.match(await page.getByRole('dialog').innerText(), /활동 분야 \(1\/3\)/)
    await page.getByRole('button', { name: '보완 후 다시 제출' }).click()
    await page.waitForFunction(() => window.done)
    const calls = await page.evaluate(() => window.calls)
    assert.deepEqual(calls.filter((call) => call.method !== 'GET').map(({ method, path }) => [method, path]), [
      ['PATCH', '/api/creator/applications/9'], ['POST', '/api/creator/applications/9/resubmit'],
    ])
    assert.deepEqual(calls.find((call) => call.method === 'PATCH').body.categoryCodes, ['FOOD'])
  } finally { await page.close() }
})
