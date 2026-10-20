import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'
// 닫기 애니메이션 복사본(playExitAnimation)은 모션을 줄인 환경에서는 생략되므로, 여기서는 모션을 켠 브라우저로 실제 동작을 본다.
let bundle, css, browser
const ghosts = (page) => page.locator('body > div[aria-hidden="true"]')

test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent',
    // StrictMode의 효과 재실행은 개발 빌드에서만 일어난다.
    define: { 'process.env.NODE_ENV': JSON.stringify('development') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/bottomSheetExitBrowser.jsx', import.meta.url)), name: 'Exit283', formats: ['iife'] } },
  })
  const parts = (Array.isArray(output) ? output[0] : output).output
  bundle = parts.find((part) => part.type === 'chunk').code
  css = parts.filter((part) => part.type === 'asset' && part.fileName.endsWith('.css')).map((part) => part.source).join('\n')
  const paths = [process.env.UI_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => { await browser?.close() })

async function screen() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' })
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<html><body><div id="root"></div></body></html>' }) : route.abort())
  await page.goto('http://localhost/exit283')
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: bundle })
  await page.getByRole('button', { name: '시트 열기' }).waitFor()
  return page
}

test('StrictMode에서 시트를 열기만 해서는 닫기 복사본이 생기지 않는다', async () => {
  const page = await screen()
  try {
    await page.getByRole('button', { name: '시트 열기' }).click()
    await page.getByRole('dialog', { name: '부모 시트' }).waitFor()
    await page.getByRole('button', { name: '중첩 열기' }).click()
    await page.getByRole('dialog', { name: '중첩 시트' }).waitFor()
    await page.waitForTimeout(100)
    assert.equal(await ghosts(page).count(), 0)
    assert.equal(await page.getByRole('dialog').count(), 2)
  } finally { await page.close() }
})

test('시트를 닫으면 복사본이 하나만 생겨 클릭을 가로막지 않고 사라진다', async () => {
  const page = await screen()
  try {
    await page.getByRole('button', { name: '시트 열기' }).click()
    await page.getByRole('dialog').waitFor()
    await page.getByRole('textbox', { name: '메모' }).fill('쓰던 내용')
    await page.getByRole('button', { name: '닫기', exact: true }).click()
    await page.getByRole('dialog').waitFor({ state: 'detached' })
    await ghosts(page).first().waitFor()
    assert.equal(await ghosts(page).count(), 1)
    const ghost = ghosts(page).first()
    assert.equal(await ghost.evaluate((node) => getComputedStyle(node).pointerEvents), 'none')
    assert.equal(await ghost.locator('textarea').inputValue(), '쓰던 내용')
    // 복사본이 남아 있는 동안에도 뒤 화면의 버튼이 눌린다.
    await page.getByRole('button', { name: /^뒤 화면 버튼/ }).click({ timeout: 1000 })
    await page.getByRole('button', { name: '뒤 화면 버튼 1' }).waitFor()
    await ghosts(page).first().waitFor({ state: 'detached' })
  } finally { await page.close() }
})

test('중첩 시트를 닫은 직후에도 아래 시트를 바로 조작할 수 있다', async () => {
  const page = await screen()
  try {
    await page.getByRole('button', { name: '시트 열기' }).click()
    await page.getByRole('button', { name: '중첩 열기' }).click()
    await page.getByRole('dialog', { name: '중첩 시트' }).waitFor()
    await page.getByRole('button', { name: '중첩 닫기' }).click()
    await page.getByRole('dialog', { name: '중첩 시트' }).waitFor({ state: 'detached' })
    assert.equal(await ghosts(page).count(), 1)
    // 복사본이 남아 있는 바로 이 순간에 그 자리를 누르면 부모 시트의 버튼이 받아야 한다(복사본이 가로채면 안 된다).
    const target = await page.getByRole('button', { name: '부모 안 버튼' }).evaluate((node) => {
      const box = node.getBoundingClientRect()
      return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2) === node
    })
    assert.equal(target, true)
    await page.getByRole('button', { name: '부모 안 버튼' }).click({ timeout: 1000 })
    await page.getByRole('button', { name: /^뒤 화면 버튼 10$/ }).waitFor()
    assert.equal(await page.getByRole('dialog', { name: '부모 시트' }).count(), 1)
    await ghosts(page).first().waitFor({ state: 'detached' })
  } finally { await page.close() }
})
