import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'

test('공통 배지와 실제 목록·홈 항목이 같은 접근성 이름과 반응형 스타일을 사용한다', async () => {
  const result = await build({
    configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, lib: { entry: fileURLToPath(new URL('./fixtures/creatorBadgeBrowser.jsx', import.meta.url)), name: 'BadgeTest', formats: ['iife'] } },
  })
  const code = (Array.isArray(result) ? result[0] : result).output.find((part) => part.type === 'chunk').code
  const executablePath = [process.env.QUIZ_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean).find(existsSync)
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) })
  try {
    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.route('**/*', (route) => route.abort())
    await page.setContent('<div id="root"></div>')
    await page.addScriptTag({ content: code })
    const badges = page.getByRole('img', { name: '인증된 크리에이터', exact: true })
    await badges.nth(2).waitFor()
    assert.equal(await badges.count(), 3)
    const markup = await badges.evaluateAll((nodes) => nodes.map((node) => node.outerHTML))
    assert.equal(new Set(markup).size, 1)
    for (const badge of await badges.all()) {
      assert.equal(await badge.textContent(), 'verified')
      assert.match(await badge.getAttribute('class'), /text-primary/)
      assert.match(await badge.getAttribute('class'), /md:text-\[18px\]/)
    }
    assert.deepEqual(errors, [])
  } finally {
    await browser.close()
  }
})
