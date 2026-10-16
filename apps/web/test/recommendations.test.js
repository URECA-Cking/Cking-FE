import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'

let bundle, browser

test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/recommendationsBrowser.jsx', import.meta.url)), name: 'RecommendationsTest', formats: ['iife'] } },
  })
  bundle = (Array.isArray(output) ? output[0] : output).output.find((part) => part.type === 'chunk').code
  const paths = [process.env.HOME_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => { await browser?.close() })

const CATALOG = ['가', '나', '다'].map((name, index) => ({
  creatorId: index + 1, creatorName: `크리${name}`, slug: `c${index + 1}`, introText: '', profileImageUrl: null, bannerImageUrl: null,
}))
const recommendation = (requestId, ...creatorIds) => ({
  status: 200, code: 'SUCCESS',
  data: { recommendationRequestId: requestId, policyVersion: 'INTEREST_PERSONALIZED_V1', items: creatorIds.map((creatorId) => ({ creatorId, creatorName: `크리${creatorId}`, interestCodes: [], seedCreatorIds: [] })) },
})
const catalog = { status: 200, code: 'SUCCESS', data: { items: CATALOG, page: 0, size: 100, totalElements: 3, totalPages: 1, hasNext: false } }
const failure = { status: 500, code: 'SYSTEM_ERROR', message: '일시적인 오류' }

/**
 * 외부 요청을 막은 빈 화면에 번들을 올리고, fetch를 경로별 큐로 바꿔 테스트가 응답을 순서대로 정한다.
 * 큐가 비면 오류 응답을 주고, deferred 응답은 resolve.<경로>()를 부를 때까지 대기시킨다.
 */
async function screen() {
  const page = await browser.newPage()
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }) : route.abort())
  await page.goto('http://localhost/recommendations-test')
  await page.evaluate(() => {
    window.queues = { recommendation: [], catalog: [] }
    window.resolvers = {}
    const envelope = (plan) => new Response(JSON.stringify({ code: plan.code, data: plan.data ?? null, message: plan.message ?? null }), { status: plan.status })
    window.fetch = (url) => {
      const path = new URL(String(url), location.href).pathname
      const key = path === '/api/me/creator-recommendations' ? 'recommendation' : 'catalog'
      const plan = window.queues[key].shift() ?? { status: 500, code: 'SYSTEM_ERROR', message: '대기열 없음' }
      if (plan.deferred) return new Promise((resolve) => { window.resolvers[key] = () => resolve(envelope(plan.deferred)) })
      return Promise.resolve(envelope(plan))
    }
  })
  await page.addScriptTag({ content: bundle })
  return page
}

const enqueue = (page, key, ...plans) => page.evaluate(({ key, plans }) => { window.queues[key].push(...plans) }, { key, plans })
const read = (page, id) => page.getByTestId(id).textContent()
const waitText = (page, id, text) => page.waitForFunction(({ id, text }) => document.querySelector(`[data-testid="${id}"]`)?.textContent === text, { id, text })

test('회원이 바뀌면 새 응답이 오기 전에는 이전 회원의 추천과 응답 ID를 내보내지 않는다', async () => {
  const page = await screen()
  await enqueue(page, 'recommendation', recommendation('rid-A', 1, 2))
  await enqueue(page, 'catalog', catalog)
  await page.evaluate(() => window.renderRecommendations(1))
  await waitText(page, 'items', '크리가,크리나')
  assert.equal(await read(page, 'request'), 'rid-A')

  // 회원 B의 조회를 붙잡아 둔 채 같은 화면에서 회원만 바꾼다.
  await enqueue(page, 'recommendation', { deferred: recommendation('rid-B', 3) })
  await page.evaluate(() => window.renderRecommendations(2))
  await waitText(page, 'loading', 'true')
  assert.equal(await read(page, 'items'), '')
  assert.equal(await read(page, 'request'), '')

  await page.evaluate(() => window.resolvers.recommendation())
  await waitText(page, 'items', '크리다')
  assert.equal(await read(page, 'request'), 'rid-B')
  await page.close()
})

test('새 회원의 조회가 실패하면 이전 회원의 추천 대신 오류를 보인다', async () => {
  const page = await screen()
  await enqueue(page, 'recommendation', recommendation('rid-A', 1), failure)
  await enqueue(page, 'catalog', catalog)
  await page.evaluate(() => window.renderRecommendations(1))
  await waitText(page, 'items', '크리가')

  await page.evaluate(() => window.renderRecommendations(2))
  await page.waitForFunction(() => document.querySelector('[data-testid="error"]')?.textContent !== '')
  assert.equal(await read(page, 'items'), '')
  assert.equal(await read(page, 'request'), '')
  assert.equal(await read(page, 'loading'), 'false')
  await page.close()
})

test('추천은 성공했어도 프로필 목록이 실패하면 빈 추천이 아니라 오류로 보이고, 다시 시도하면 추천이 나온다', async () => {
  const page = await screen()
  await enqueue(page, 'recommendation', recommendation('rid-A', 1, 3))
  await enqueue(page, 'catalog', failure, catalog)
  await page.evaluate(() => window.renderRecommendations(1))
  await page.waitForFunction(() => document.querySelector('[data-testid="error"]')?.textContent !== '')
  assert.equal(await read(page, 'items'), '')
  assert.equal(await read(page, 'loading'), 'false')

  await page.evaluate(() => window.reloadRecommendations())
  await waitText(page, 'items', '크리가,크리다')
  assert.equal(await read(page, 'error'), '')
  await page.close()
})

test('추천은 있는데 프로필 목록에서 하나도 찾지 못하면 빈 추천이 아니라 오류로 보이고, 다시 시도하면 목록을 새로 받아 추천이 나온다', async () => {
  const page = await screen()
  // 캐시된 목록에는 새로 생긴 크리에이터(7, 8)가 없다. 다시 시도에서 받은 목록에는 있다.
  const fresh = { ...catalog, data: { ...catalog.data, items: [...CATALOG, ...[7, 8].map((id) => ({ creatorId: id, creatorName: `신규${id}`, slug: `n${id}`, introText: '', profileImageUrl: null, bannerImageUrl: null }))] } }
  await enqueue(page, 'recommendation', recommendation('rid-A', 7, 8))
  await enqueue(page, 'catalog', catalog, fresh)
  await page.evaluate(() => window.renderRecommendations(1))
  await page.waitForFunction(() => document.querySelector('[data-testid="error"]')?.textContent !== '')
  assert.equal(await read(page, 'items'), '')
  assert.equal(await read(page, 'loading'), 'false')

  await page.evaluate(() => window.reloadRecommendations())
  await waitText(page, 'items', '신규7,신규8')
  assert.equal(await read(page, 'error'), '')
  await page.close()
})

test('추천 일부만 프로필 목록에 없으면 찾은 항목만 보여 주고 오류로 보지 않는다', async () => {
  const page = await screen()
  await enqueue(page, 'recommendation', recommendation('rid-A', 1, 7))
  await enqueue(page, 'catalog', catalog)
  await page.evaluate(() => window.renderRecommendations(1))
  await waitText(page, 'items', '크리가')
  assert.equal(await read(page, 'error'), '')
  await page.close()
})
