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
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/myProfileLinkRefreshBrowser.jsx', import.meta.url)), name: 'MyProfileLinkRefreshTest', formats: ['iife'] } },
  })
  bundle = (Array.isArray(output) ? output[0] : output).output.find((part) => part.type === 'chunk').code
  const paths = [process.env.HOME_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => { await browser?.close() })

const OLD_PHOTO = 'https://images.test/profile-old.png'
const NEW_PHOTO = 'https://images.test/profile-new.png'

/**
 * 크리에이터 11이 자기 스페이스(slug test)를 보는 화면. 내 Space 조회와 저장(PATCH)은 window.space 하나를 같이 쓰고,
 * 프로필 사진 업로드는 imageKey profile-new를 돌려주며 저장하면 그 키가 NEW_PHOTO가 되고, 기본 이미지로 저장하면 사진이 없어진다.
 */
async function screen() {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }) : route.abort())
  await page.goto('http://localhost/space-test')
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 600
    canvas.height = 600
    canvas.getContext('2d').fillRect(0, 0, 600, 600)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  await page.route('https://images.test/**', (route) => route.fulfill({ contentType: 'image/png', body: Buffer.from(png, 'base64') }))
  await page.evaluate((oldPhoto) => {
    window.space = { creatorId: 11, creatorName: '테스트 크리에이터', slug: 'test', introText: '소개', profileImageUrl: oldPhoto, bannerImageUrl: 'https://images.test/banner.png', slugChangeableAt: null, followerCount: 3 }
    window.toasts = []
    const envelope = (status, code, data) => new Response(JSON.stringify({ code, data, message: null }), { status })
    window.fetch = (url, options = {}) => {
      const path = new URL(String(url), location.href).pathname
      const method = options.method ?? 'GET'
      if (path === '/api/uploads') return Promise.resolve(envelope(404, 'RESOURCE_NOT_FOUND', null))
      if (path === '/api/creator-spaces/test') return Promise.resolve(envelope(200, 'SUCCESS', { ...window.space }))
      if (path === '/api/creator/space/profile-images') return Promise.resolve(envelope(200, 'SUCCESS', { imageKey: 'profile-new' }))
      if (path === '/api/creator/space') {
        if (method === 'PATCH') {
          const body = JSON.parse(options.body)
          window.space = { ...window.space, introText: body.introText, profileImageUrl: body.profileImageKey === 'profile-new' ? 'https://images.test/profile-new.png' : body.profileImageKey === null ? null : body.profileImageUrl }
        }
        return Promise.resolve(envelope(200, 'SUCCESS', { ...window.space }))
      }
      if (path === '/api/creator/profile') return Promise.resolve(envelope(200, 'SUCCESS', null))
      if (path === '/api/creators/11/tickets') return Promise.resolve(envelope(200, 'SUCCESS', { creatorId: 11, balance: 0 }))
      if (path === '/api/creators/11/missions') return Promise.resolve(envelope(200, 'SUCCESS', []))
      if (path === '/api/creators/11/youtube-channel') return Promise.resolve(envelope(409, 'CREATOR_CHANNEL_NOT_CONFIGURED', null))
      if (path.includes('/calendar/schedules')) return Promise.resolve(envelope(200, 'SUCCESS', []))
      return Promise.resolve(envelope(200, 'SUCCESS', { items: [], page: 0, hasNext: false, totalElements: 0 }))
    }
  }, OLD_PHOTO)
  await page.addScriptTag({ content: bundle })
  return { page, errors, png }
}

const headerPhoto = (page) => page.locator('a[aria-label="마이페이지"] img').first()

test('스페이스에서 프로필 사진을 저장하면 헤더 사진도 새 사진으로 바뀐다', async () => {
  const { page, errors, png } = await screen()
  try {
    await page.evaluate(() => window.renderSpace())
    await page.waitForFunction((photo) => document.querySelector('a[aria-label="마이페이지"] img')?.src === photo, OLD_PHOTO)

    await page.getByRole('button', { name: '스페이스 편집' }).first().click()
    const sheet = page.getByRole('dialog')
    await sheet.locator('input[type=file]').first().setInputFiles({ name: 'image.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
    const save = sheet.getByRole('button', { name: '저장', exact: true })
    await page.waitForFunction(() => {
      const button = [...document.querySelectorAll('[role=dialog] button')].find((element) => element.textContent === '저장')
      return button && !button.disabled
    })
    await save.click()
    await page.waitForFunction(() => window.toasts.includes('스페이스 정보를 저장했어요.'))

    await page.waitForFunction((photo) => document.querySelector('a[aria-label="마이페이지"] img')?.src === photo, NEW_PHOTO)
    assert.equal(await headerPhoto(page).getAttribute('src'), NEW_PHOTO)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})

test('스페이스에서 프로필 사진을 기본 이미지로 저장하면 헤더도 사람 아이콘으로 바뀐다', async () => {
  const { page, errors } = await screen()
  try {
    await page.evaluate(() => window.renderSpace())
    await page.waitForFunction((photo) => document.querySelector('a[aria-label="마이페이지"] img')?.src === photo, OLD_PHOTO)

    await page.getByRole('button', { name: '스페이스 편집' }).first().click()
    const sheet = page.getByRole('dialog')
    await sheet.getByRole('button', { name: '기본 이미지로', exact: true }).click()
    await sheet.getByRole('button', { name: '저장', exact: true }).click()
    await page.waitForFunction(() => window.toasts.includes('스페이스 정보를 저장했어요.'))

    await page.waitForFunction(() => document.querySelector('a[aria-label="마이페이지"]') && !document.querySelector('a[aria-label="마이페이지"] img'))
    assert.equal(await headerPhoto(page).count(), 0)
    assert.deepEqual(errors, [])
  } finally { await page.close() }
})
