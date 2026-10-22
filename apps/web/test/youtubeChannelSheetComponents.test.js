import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'
// 구독 인증 채널 설정 시트: 입력 칸은 "채널 아이디"로 부르고, 다른 크리에이터가 쓰는 아이디(CHANNEL_HANDLE_CONFLICT)는 토스트로만 알린다(#357).
let bundle, css, browser

test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production'), 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('http://youtube.test') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/youtubeChannelBrowser.jsx', import.meta.url)), name: 'YoutubeChannel', formats: ['iife'] } },
  })
  const parts = (Array.isArray(output) ? output[0] : output).output
  bundle = parts.find((part) => part.type === 'chunk').code
  css = parts.filter((part) => part.type === 'asset' && part.fileName.endsWith('.css')).map((part) => part.source).join('\n')
  const paths = [process.env.UI_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => { await browser?.close() })

/** putReply: PUT 저장 요청의 응답 { status, code, data, message } */
async function screen(putReply) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<html><body><div id="root"></div></body></html>' }) : route.abort())
  await page.goto('http://localhost/youtube-channel')
  await page.addStyleTag({ content: css })
  await page.evaluate((reply) => {
    window.puts = []
    window.fetch = async (url, options = {}) => {
      const path = new URL(String(url), location.href).pathname
      const respond = ({ status = 200, code = 'SUCCESS', data = null, message = '' }) => new Response(JSON.stringify({ code, data, message }), { status })
      if (path === '/api/creator/youtube-channel') {
        if ((options.method ?? 'GET') === 'PUT') { window.puts.push(JSON.parse(options.body)); return respond(reply) }
        return respond({ status: 409, code: 'CREATOR_CHANNEL_NOT_CONFIGURED', message: '미설정' })
      }
      throw new Error(`예상하지 않은 API 요청 ${path}`)
    }
  }, putReply)
  await page.addScriptTag({ content: bundle })
  await page.getByRole('dialog', { name: '구독 인증 채널 설정' }).waitFor()
  await page.getByPlaceholder('채널명을 입력해주세요').waitFor()
  return page
}
const fillAndSave = async (page) => {
  await page.getByPlaceholder('채널명을 입력해주세요').fill('내 채널')
  await page.getByLabel('채널 아이디').fill('Example')
  await page.getByRole('button', { name: '채널 설정하고 미션 생성' }).click()
}

test('입력 칸은 "채널 아이디"로 보이고 "handle"·"핸들명" 문구는 없다', async () => {
  const page = await screen({ data: {} })
  try {
    await page.getByText('채널 아이디', { exact: true }).waitFor()
    const text = await page.getByRole('dialog').innerText()
    assert.doesNotMatch(text, /handle|핸들/)
  } finally { await page.close() }
})

test('이미 쓰는 채널 아이디면 에러 토스트만 뜨고, 입력값은 남고 다시 저장할 수 있다', async () => {
  const page = await screen({ status: 409, code: 'CHANNEL_HANDLE_CONFLICT', message: '이미 사용 중인 YouTube 채널 handle입니다.' })
  try {
    await fillAndSave(page)
    await page.waitForFunction(() => window.toasts.length === 1)
    assert.deepEqual(await page.evaluate(() => window.toasts), [{ message: '이미 사용 중인 채널 아이디예요.', icon: 'error' }])
    assert.equal(await page.getByRole('alert').count(), 0)
    assert.equal(await page.getByLabel('채널 아이디').inputValue(), 'Example')
    assert.equal(await page.getByRole('button', { name: '채널 설정하고 미션 생성' }).isDisabled(), false)
  } finally { await page.close() }
})

test('그 밖의 저장 오류는 지금처럼 시트 안에 보이고 토스트는 없다', async () => {
  const page = await screen({ status: 409, code: 'INVALID_STATE', message: '변경 불가' })
  try {
    await fillAndSave(page)
    await page.getByRole('alert').waitFor()
    assert.match(await page.getByRole('alert').innerText(), /처리 중인 구독 인증/)
    assert.deepEqual(await page.evaluate(() => window.toasts), [])
  } finally { await page.close() }
})

test('정상 저장은 기존처럼 성공 토스트를 띄운다', async () => {
  const page = await screen({ data: { channelName: '내 채널', channelHandle: '@example', updatedAt: '2026-10-21T00:00:00Z' } })
  try {
    await fillAndSave(page)
    await page.waitForFunction(() => window.toasts.length === 1)
    assert.deepEqual(await page.evaluate(() => window.toasts), [{ message: 'YouTube 채널을 설정했어요. 구독 인증 미션이 생성되었어요.', icon: 'check_circle' }])
    assert.deepEqual(await page.evaluate(() => window.puts), [{ channelName: '내 채널', channelHandle: 'Example' }])
  } finally { await page.close() }
})
