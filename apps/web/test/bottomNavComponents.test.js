import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'
// 하단 내비게이션: 선택 표시는 left가 아니라 translate로 움직이면서도 항상 선택한 탭 아래에 놓이고, 다른 탭을 누르면 펄스는 화면 전환 직후가 아니라 프레임이 안정된 뒤에 시작한다(#375).
let bundle, css, browser

test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/bottomNavBrowser.jsx', import.meta.url)), name: 'BottomNavTest', formats: ['iife'] } },
  })
  const parts = (Array.isArray(output) ? output[0] : output).output
  bundle = parts.find((part) => part.type === 'chunk').code
  css = parts.filter((part) => part.type === 'asset' && part.fileName.endsWith('.css')).map((part) => part.source).join('\n')
  const paths = [process.env.UI_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => { await browser?.close() })

async function screen() {
  // 모션을 줄이지 않은 환경에서 애니메이션이 실제로 돈다.
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' })
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<html><body><div id="root"></div></body></html>' }) : route.abort())
  await page.goto('http://localhost/nav-test')
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: bundle })
  await page.getByRole('link', { name: '홈' }).waitFor()
  return page
}
const tab = (page, name) => page.getByRole('link', { name, exact: true })
const indicatorGap = (page, name) => page.evaluate((label) => {
  const link = document.querySelector(`nav a[aria-label="${label}"]`).getBoundingClientRect()
  const indicator = document.querySelector('.liquid-nav-indicator').getBoundingClientRect()
  return Math.abs((link.left + link.width / 2) - (indicator.left + indicator.width / 2))
}, name)

for (const compact of [false, true]) {
  test(`선택 표시는 translate로 움직이고 ${compact ? '줄어든' : '기본'} 독에서도 선택한 탭 아래에 놓인다`, async () => {
    const page = await screen()
    try {
      if (compact) {
        await page.evaluate(() => window.setCompact(true))
        await page.waitForTimeout(700)
      }
      for (const name of ['탐색', '내 응모', 'MY', '홈']) {
        await tab(page, name).click()
        await page.waitForTimeout(1100) // 이동(520ms)과 젤리 효과가 끝나기를 기다린다.
        assert.ok(await indicatorGap(page, name) <= 2, `${name} 아래에 있어야 한다`)
      }
      assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.liquid-nav-indicator')).left), '10px')
      await tab(page, 'MY').click()
      await page.waitForTimeout(1100)
      const translate = await page.evaluate(() => getComputedStyle(document.querySelector('.liquid-nav-indicator')).translate)
      assert.equal(translate, 'calc(300% + 60px)') // 마지막 칸(3번)은 (요소 너비 + 20px) × 3만큼 이동해 있다.
    } finally { await page.close() }
  })
}

/** 클릭한 뒤 활성 탭이 바뀐 시각과 펄스(is-pulsing)가 시작된 시각의 차(ms)를 잰다. 펄스가 없으면 null. */
async function pulseDelay(page, name) {
  await page.evaluate(() => {
    window.timeline = { active: null, pulse: null }
    const nav = document.querySelector('nav')
    new MutationObserver(() => {
      const dock = document.querySelector('.liquid-nav-dock')
      if (window.timeline.active === null && document.querySelector('nav a[aria-current="page"]')?.getAttribute('aria-label') !== window.startTab) window.timeline.active = performance.now()
      if (window.timeline.pulse === null && dock.classList.contains('is-pulsing')) window.timeline.pulse = performance.now()
    }).observe(nav, { attributes: true, subtree: true, attributeFilter: ['class', 'aria-current'] })
    window.startTab = document.querySelector('nav a[aria-current="page"]')?.getAttribute('aria-label')
  })
  const clickedAt = await page.evaluate(() => performance.now())
  await tab(page, name).click()
  await page.waitForTimeout(1200)
  return page.evaluate((clicked) => ({ active: window.timeline.active - clicked, pulse: window.timeline.pulse === null ? null : window.timeline.pulse - clicked }), clickedAt)
}

test('다른 탭을 누르면 펄스는 화면 전환 직후가 아니라 프레임이 안정된 뒤에 시작한다', async () => {
  const page = await screen()
  try {
    const { active, pulse } = await pulseDelay(page, '탐색')
    assert.ok(pulse !== null, '펄스가 시작되어야 한다')
    assert.ok(pulse - active >= 30, `활성 탭이 바뀐 뒤 최소 몇 프레임 지나 시작해야 한다: ${pulse - active}ms`)
  } finally { await page.close() }
})

test('이미 선택한 탭을 다시 누르면 펄스를 바로 시작한다', async () => {
  const page = await screen()
  try {
    const { pulse } = await pulseDelay(page, '홈')
    assert.ok(pulse !== null && pulse < 60, `재선택은 바로 펄스: ${pulse}ms`)
  } finally { await page.close() }
})
