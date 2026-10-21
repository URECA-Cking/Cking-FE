import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'
// 온보딩 1단계의 브라우저·기기 뒤로가기: 헤더 뒤로가기와 같이 확인 시트가 열리고, 건너뛴 뒤에는 온보딩이 되살아나지 않는다.
let bundle, css, browser

test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/onboardingHistoryBrowser.jsx', import.meta.url)), name: 'OnboardingDeviceBack', formats: ['iife'] } },
  })
  const parts = (Array.isArray(output) ? output[0] : output).output
  bundle = parts.find((part) => part.type === 'chunk').code
  css = parts.filter((part) => part.type === 'asset' && part.fileName.endsWith('.css')).map((part) => part.source).join('\n')
  const paths = [process.env.UI_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => { await browser?.close() })

const sheetName = '온보딩을 건너뛸까요?'

// 로그인 전 화면(/before-login) 다음에 온보딩이 열린 상태. 온보딩은 /my-page로 가려던 신규 가입자 것이다.
async function screen() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  page.completeCalls = 0
  await page.route('**/*', (route) => {
    const request = route.request()
    if (request.isNavigationRequest()) return route.fulfill({ contentType: 'text/html', body: '<html><body><div id="root"></div></body></html>' })
    if (request.method() === 'PUT' && request.url().endsWith('/api/me/onboarding/complete')) {
      page.completeCalls += 1
      return route.fulfill({ status: 204 })
    }
    // 2단계 추천에 크리에이터 한 명을 보여, 크리에이터 스페이스를 둘러보는 흐름을 만들 수 있게 한다.
    if (request.method() === 'GET' && request.url().includes('/api/me/creator-recommendations')) {
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 'SUCCESS', data: { policyVersion: 'v1', items: [{ creatorId: 7, creatorName: '추천크리에이터', interestCodes: [], seedCreatorIds: [] }] } }) })
    }
    return route.abort()
  })
  await page.goto('http://localhost/before-login')
  await page.goto('http://localhost/onboarding')
  // 로그인 콜백이 replace로 넘겨 주는 상태(가려던 화면)를 흉내 낸다.
  await page.evaluate(() => window.history.replaceState({ usr: { from: '/my-page' }, key: 'start', idx: 0 }, ''))
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: bundle })
  await page.getByRole('button', { name: '뒤로가기' }).waitFor()
  return page
}

test('기기 뒤로가기를 누르면 온보딩을 떠나지 않고 확인 시트가 열린다', async () => {
  const page = await screen()
  try {
    await page.evaluate(() => window.history.back())
    await page.getByRole('dialog', { name: sheetName }).waitFor()
    assert.equal(new URL(page.url()).pathname, '/onboarding')
    assert.equal(page.completeCalls, 0)
  } finally { await page.close() }
})

test('시트가 열린 채 기기 뒤로가기를 누르면 시트만 닫히고, 다시 누르면 시트가 열린다', async () => {
  const page = await screen()
  try {
    await page.getByRole('button', { name: '뒤로가기' }).click()
    const sheet = page.getByRole('dialog', { name: sheetName })
    await sheet.waitFor()
    await page.evaluate(() => window.history.back())
    await sheet.waitFor({ state: 'detached' })
    assert.equal(new URL(page.url()).pathname, '/onboarding')
    await page.evaluate(() => window.history.back())
    await sheet.waitFor()
    assert.equal(new URL(page.url()).pathname, '/onboarding')
  } finally { await page.close() }
})

test('건너뛴 뒤 이동한 화면에서 뒤로가기를 눌러도 온보딩이 되살아나지 않는다', async () => {
  const page = await screen()
  try {
    await page.evaluate(() => window.history.back())
    await page.getByRole('dialog', { name: sheetName }).getByRole('button', { name: '건너뛰기', exact: true }).click()
    await page.getByText('마이페이지 화면 (/my-page)').waitFor()
    assert.equal(page.completeCalls, 1)
    await page.goBack()
    assert.equal(new URL(page.url()).pathname, '/before-login')
  } finally { await page.close() }
})

test('1단계 → 2단계 → 시작하기로 마친 뒤 이동한 화면에서 뒤로가기를 눌러도 온보딩이 되살아나지 않는다', async () => {
  const page = await screen()
  try {
    await page.getByRole('button', { name: '건너뛰기', exact: true }).click()
    await page.getByText('Cking 단계 2/2').waitFor()
    // 되감는 동안 1단계 화면이 한 프레임이라도 비치는지 지켜본다.
    await page.evaluate(() => {
      window.sawStepOne = false
      new MutationObserver(() => { if (document.body.innerText.includes('단계 1/2')) window.sawStepOne = true })
        .observe(document.body, { childList: true, subtree: true, characterData: true })
    })
    await page.getByRole('button', { name: '시작하기' }).click()
    await page.getByText('마이페이지 화면 (/my-page)').waitFor()
    assert.equal(page.completeCalls, 1)
    assert.equal(await page.evaluate(() => window.sawStepOne), false)
    await page.goBack()
    assert.equal(new URL(page.url()).pathname, '/before-login')
  } finally { await page.close() }
})

test('1단계에서 다음을 연달아 눌러도 2단계 기록이 한 번만 쌓여 마친 뒤 뒤로가기가 로그인 전 화면으로 간다', async () => {
  const page = await screen()
  try {
    await page.getByRole('button', { name: '건너뛰기', exact: true }).dblclick()
    await page.getByText('Cking 단계 2/2').waitFor()
    await page.getByRole('button', { name: '시작하기' }).click()
    await page.getByText('마이페이지 화면 (/my-page)').waitFor()
    await page.goBack()
    assert.equal(new URL(page.url()).pathname, '/before-login')
  } finally { await page.close() }
})

test('2단계에서 크리에이터 스페이스를 둘러보고 돌아와 마쳐도 이동한 화면에서 뒤로가기를 누르면 로그인 전 화면으로 간다', async () => {
  const page = await screen()
  try {
    await page.getByRole('button', { name: '건너뛰기', exact: true }).click()
    await page.getByText('Cking 단계 2/2').waitFor()
    // 스페이스로 나가면 온보딩이 언마운트됐다가 돌아올 때 새로 마운트된다.
    await page.getByRole('link', { name: /추천크리에이터/ }).click()
    await page.getByText('크리에이터 스페이스 화면').waitFor()
    await page.goBack()
    await page.getByText('Cking 단계 2/2').waitFor()
    await page.getByRole('button', { name: '시작하기' }).click()
    await page.getByText('마이페이지 화면 (/my-page)').waitFor()
    assert.equal(page.completeCalls, 1)
    await page.goBack()
    assert.equal(new URL(page.url()).pathname, '/before-login')
  } finally { await page.close() }
})

test('2단계에서 기기 뒤로가기를 누르면 1단계로 돌아오고, 거기서 다시 누르면 확인 시트가 열린다', async () => {
  const page = await screen()
  try {
    await page.getByRole('button', { name: '건너뛰기', exact: true }).click()
    await page.getByText('Cking 단계 2/2').waitFor()
    await page.evaluate(() => window.history.back())
    await page.getByText('Cking 단계 1/2').waitFor()
    assert.equal(new URL(page.url()).pathname, '/onboarding')
    await page.evaluate(() => window.history.back())
    await page.getByRole('dialog', { name: sheetName }).waitFor()
    assert.equal(new URL(page.url()).pathname, '/onboarding')
  } finally { await page.close() }
})
