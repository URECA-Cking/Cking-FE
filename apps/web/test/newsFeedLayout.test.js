import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'
import tailwindConfig from '../tailwind.config.js'

let bundle, css, browser

test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()],
    // 실행 위치(CWD)와 무관하게 Tailwind가 컴파일되도록 PostCSS 플러그인과 content 경로를 직접 지정한다.
    css: { postcss: { plugins: [tailwindcss({ ...tailwindConfig, content: [fileURLToPath(new URL('../src/**/*.{js,jsx}', import.meta.url)), fileURLToPath(new URL('./fixtures/**/*.{js,jsx}', import.meta.url))] }), autoprefixer()] } },
    logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/newsFeedBrowser.jsx', import.meta.url)), name: 'NewsFeedTest', formats: ['iife'] } },
  })
  const parts = (Array.isArray(output) ? output[0] : output).output
  bundle = parts.find((part) => part.type === 'chunk').code
  css = parts.filter((part) => part.type === 'asset' && part.fileName.endsWith('.css')).map((part) => part.source).join('\n')
  const paths = [process.env.UI_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => { await browser?.close() })

/** 실제 CSS를 입힌 빈 화면에 새 게시물 영역 번들을 올리고, 지정한 모바일 폭으로 연다. */
async function screen(width) {
  const page = await browser.newPage({ viewport: { width, height: 844 }, hasTouch: true })
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<html><body><div id="root"></div></body></html>' }) : route.abort())
  await page.goto('http://localhost/news-feed-test')
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: bundle })
  await page.evaluate(() => window.renderNewsFeed())
  await page.getByText('새 게시물 1', { exact: true }).waitFor()
  return page
}

for (const width of [360, 375, 390, 430]) {
  test(`${width}px: 새 게시물 영역이 있어도 문서 폭은 뷰포트 폭과 같고, 카드 목록만 가로로 스크롤된다`, async () => {
    const page = await screen(width)
    try {
      const { docWidth, scrollable } = await page.evaluate(() => {
        const list = document.querySelector('.overflow-x-auto')
        return { docWidth: document.documentElement.scrollWidth, scrollable: list.scrollWidth > list.clientWidth }
      })
      assert.equal(docWidth, width)
      assert.equal(scrollable, true)
    } finally { await page.close() }
  })
}
