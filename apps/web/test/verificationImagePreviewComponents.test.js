import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'
// 구독 인증 이미지를 고르면 제출(업로드) 전에 미리보기를 보여 주고, 바뀌거나 사라질 때 미리보기 주소를 해제한다(#381).
let bundle, css, browser

test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production'), 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('http://verify.test') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/verificationCardBrowser.jsx', import.meta.url)), name: 'VerificationCard', formats: ['iife'] } },
  })
  const parts = (Array.isArray(output) ? output[0] : output).output
  bundle = parts.find((part) => part.type === 'chunk').code
  css = parts.filter((part) => part.type === 'asset' && part.fileName.endsWith('.css')).map((part) => part.source).join('\n')
  const paths = [process.env.UI_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => { await browser?.close() })

/** postReply: 제출(POST) 응답 { status, code, data, message } */
async function screen(postReply = { status: 200, data: { status: 'VERIFYING' } }) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.addInitScript(() => {
    window.revoked = []
    const revoke = URL.revokeObjectURL.bind(URL)
    URL.revokeObjectURL = (url) => { window.revoked.push(url); revoke(url) }
  })
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<html><body><div id="root"></div></body></html>' }) : route.abort())
  await page.goto('http://localhost/verification-card')
  await page.addStyleTag({ content: css })
  const png = await page.evaluate(() => {
    const draw = (color) => { const canvas = document.createElement('canvas'); canvas.width = 40; canvas.height = 30; const context = canvas.getContext('2d'); context.fillStyle = color; context.fillRect(0, 0, 40, 30); return canvas.toDataURL('image/png').split(',')[1] }
    return [draw('#cc0000'), draw('#0000cc')]
  })
  await page.evaluate((reply) => {
    window.posts = []
    window.fetch = async (url, options = {}) => {
      const path = new URL(String(url), location.href).pathname
      const respond = ({ status = 200, code = 'SUCCESS', data = null, message = '' }) => new Response(JSON.stringify({ code, data, message }), { status })
      if (path.endsWith('/subscription-verifications/me/latest')) return respond(window.latest ?? { status: 404, code: 'VERIFICATION_NOT_FOUND', message: '없음' })
      if (path.endsWith('/subscription-verifications') && (options.method ?? 'GET') === 'POST') {
        window.posts.push({ hasImage: options.body instanceof FormData && options.body.has('image'), requestId: options.body.get('requestId') })
        if (reply.status === 200) window.latest = { status: 200, data: reply.data }
        return respond(reply)
      }
      throw new Error(`예상하지 않은 API 요청 ${path}`)
    }
  }, postReply)
  await page.addScriptTag({ content: bundle })
  await page.getByRole('button', { name: '인증 이미지 선택' }).waitFor()
  return { page, png }
}
const pick = (page, base64, name = 'proof.png', mimeType = 'image/png') =>
  page.locator('input[type=file]').setInputFiles({ name, mimeType, buffer: Buffer.from(base64, 'base64') })
const preview = (page) => page.getByAltText('선택한 인증 이미지 미리보기')

test('이미지를 고르면 제출 전에 미리보기와 파일 이름이 보이고 서버로는 아무것도 보내지 않는다', async () => {
  const { page, png } = await screen()
  try {
    assert.equal(await preview(page).count(), 0)
    await pick(page, png[0])
    await preview(page).waitFor()
    await page.waitForFunction(() => { const image = document.querySelector('img[alt="선택한 인증 이미지 미리보기"]'); return image?.complete && image.naturalWidth === 40 })
    assert.match(await preview(page).getAttribute('src'), /^blob:/)
    await page.getByText('선택됨: proof.png').waitFor()
    assert.deepEqual(await page.evaluate(() => window.posts), [])
  } finally { await page.close() }
})

test('다른 이미지를 고르면 미리보기가 바뀌고 이전 미리보기 주소는 해제된다', async () => {
  const { page, png } = await screen()
  try {
    await pick(page, png[0], 'first.png')
    await preview(page).waitFor()
    const first = await preview(page).getAttribute('src')
    await pick(page, png[1], 'second.png')
    await page.getByText('선택됨: second.png').waitFor()
    await page.waitForFunction((url) => document.querySelector('img[alt="선택한 인증 이미지 미리보기"]')?.src !== url, first)
    assert.ok((await page.evaluate(() => window.revoked)).includes(first))
  } finally { await page.close() }
})

test('JPEG·PNG가 아닌 파일은 미리보기 없이 오류만 보이고 이전 미리보기도 사라진다', async () => {
  const { page, png } = await screen()
  try {
    await pick(page, png[0])
    await preview(page).waitFor()
    await pick(page, Buffer.from('gif').toString('base64'), 'proof.gif', 'image/gif')
    await page.getByRole('alert').waitFor()
    assert.match(await page.getByRole('alert').innerText(), /JPEG 또는 PNG/)
    assert.equal(await preview(page).count(), 0)
  } finally { await page.close() }
})

test('제출에 성공하면 미리보기가 사라지고, 같은 이미지가 서버로 한 번 간다', async () => {
  const { page, png } = await screen()
  try {
    await pick(page, png[0])
    await preview(page).waitFor()
    await page.getByRole('button', { name: '인증 제출' }).click()
    await page.getByText('구독 인증을 확인하고 있어요').waitFor()
    assert.equal(await preview(page).count(), 0)
    const posts = await page.evaluate(() => window.posts)
    assert.equal(posts.length, 1)
    assert.equal(posts[0].hasImage, true)
  } finally { await page.close() }
})

test('제출에 실패하면 같은 이미지의 미리보기가 남아 다시 제출할 수 있다', async () => {
  const { page, png } = await screen({ status: 500, code: 'SYSTEM_ERROR', message: '오류' })
  try {
    await pick(page, png[0])
    await preview(page).waitFor()
    await page.getByRole('button', { name: '인증 제출' }).click()
    await page.getByRole('alert').waitFor()
    assert.equal(await preview(page).count(), 1)
    assert.equal(await page.getByRole('button', { name: '인증 제출' }).isDisabled(), false)
  } finally { await page.close() }
})

test('카드가 사라질 때 미리보기 주소를 해제한다', async () => {
  const { page, png } = await screen()
  try {
    await pick(page, png[0])
    await preview(page).waitFor()
    const url = await preview(page).getAttribute('src')
    await page.evaluate(() => window.unmountCard())
    await page.waitForFunction((value) => window.revoked.includes(value), url)
  } finally { await page.close() }
})
