import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'

let bundle, styles, browser

test.before(async () => {
  const output = await build({ configFile: false, plugins: [react()], logLevel: 'silent',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: { write: false, minify: false, lib: { entry: fileURLToPath(new URL('./fixtures/exploreBrowser.jsx', import.meta.url)), name: 'ExploreTest', formats: ['iife'] } },
  })
  const parts = (Array.isArray(output) ? output[0] : output).output
  bundle = parts.find((part) => part.type === 'chunk').code
  // 실제 토큰·Tailwind 스타일을 올려야 다크·라이트 모드에서 색을 읽을 수 있다.
  styles = parts.filter((part) => part.type === 'asset' && part.fileName.endsWith('.css')).map((part) => part.source).join('\n')
  const paths = [process.env.HOME_TEST_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean)
  browser = await chromium.launch({ headless: true, ...(paths.find(existsSync) ? { executablePath: paths.find(existsSync) } : {}) })
})
test.after(async () => { await browser?.close() })

const END = '2099-01-01T00:00:00Z'
const creator = (creatorId, name) => ({ creatorId, creatorName: name, slug: `c${creatorId}`, introText: `${name} 소개`, profileImageUrl: null, bannerImageUrl: null })
const event = (eventId, creatorId, title, displayStatus = 'IN_PROGRESS') => ({
  eventId, creatorId, title, startAt: '2026-01-01T00:00:00Z', endAt: END, status: displayStatus === 'IN_PROGRESS' ? 'OPEN' : 'CLOSED',
  displayStatus, winnerCount: 2, drawMethod: 'WEIGHTED', prizes: [],
})
const CREATORS = [creator(1, '다온'), creator(2, '나래'), creator(3, '가을'), creator(4, '하늘')]
const EVENTS = [event(101, 1, '다온 팬미팅'), event(102, 2, '나래 팬미팅'), event(103, 2, '나래 굿즈 증정'), event(104, 3, '가을 사인회', 'CLOSED')]
const RECOMMENDATION = { recommendationRequestId: 'rid-1', policyVersion: 'INTEREST_PERSONALIZED_V1', items: [{ creatorId: 4, creatorName: '하늘', interestCodes: [], seedCreatorIds: [] }] }

/**
 * 외부 요청을 막은 빈 화면에 번들과 스타일을 올리고, fetch를 목으로 바꾼다.
 * window.requests에 호출한 경로를 쌓고, window.failures[경로]가 양수면 그 횟수만큼 먼저 오류를 돌려준다.
 * 목에 없는 경로(관심 분야·응모권 잔액 등)는 404라 해당 영역은 조용히 비거나 실패로 그려진다.
 */
async function screen(initial = '/explore', { events = EVENTS, creators = CREATORS, counts = null, failures = {} } = {}) {
  const page = await browser.newPage()
  await page.route('**/*', (route) => route.request().isNavigationRequest()
    ? route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }) : route.abort())
  await page.goto('http://localhost/explore-test')
  await page.evaluate(({ creators, events, recommendation, counts, failures }) => {
    window.requests = []
    window.failures = { ...failures }
    const reply = (status, code, data, message = null) => Promise.resolve(new Response(JSON.stringify({ code, data, message }), { status }))
    const pageOf = (items, params) => {
      const size = Number(params.get('size') ?? 20)
      const number = Number(params.get('page') ?? 0)
      const slice = items.slice(number * size, (number + 1) * size)
      return { items: slice, page: number, size, totalElements: items.length, totalPages: Math.max(Math.ceil(items.length / size), 1), hasNext: (number + 1) * size < items.length }
    }
    window.fetch = (url) => {
      const target = new URL(String(url), location.href)
      const path = target.pathname
      window.requests.push(path)
      if ((window.failures[path] ?? 0) > 0) {
        window.failures[path] -= 1
        return reply(500, 'SYSTEM_ERROR', null, '일시적인 오류')
      }
      if (path === '/api/creators') return reply(200, 'SUCCESS', pageOf(creators, target.searchParams))
      if (path === '/api/events/counts' && counts) return reply(200, 'SUCCESS', counts)
      if (path === '/api/events') {
        const status = target.searchParams.get('status')
        return reply(200, 'SUCCESS', pageOf(status ? events.filter((item) => item.displayStatus === status) : events, target.searchParams))
      }
      if (path === '/api/me/creator-recommendations') return reply(200, 'SUCCESS', recommendation)
      return reply(404, 'RESOURCE_NOT_FOUND', null, '없음')
    }
  }, { creators, events, recommendation: RECOMMENDATION, counts, failures })
  await page.addStyleTag({ content: styles })
  await page.addScriptTag({ content: bundle })
  await page.evaluate((path) => window.renderExplore(path), initial)
  return page
}

const where = (page) => page.evaluate(() => window.where())
const waitWhere = (page, expected) => page.waitForFunction((value) => window.where() === value, expected)
const search = async (page, text) => {
  await page.getByRole('searchbox').fill(text)
  await page.getByRole('searchbox').press('Enter')
}
const count = (page, path) => page.evaluate((target) => window.requests.filter((item) => item === target).length, path)

test('크리에이터 탭에서 검색하면 크리에이터 결과가 열리고 전체·이벤트로 대상을 바꿀 수 있다', async () => {
  const page = await screen()
  await page.getByText('다온').first().waitFor()

  await search(page, '나')
  await waitWhere(page, `/explore/search?q=${encodeURIComponent('나')}&type=creator`)
  await page.getByText('나래').first().waitFor()
  assert.equal(await page.getByText('다온').count(), 0)
  assert.equal(await page.getByRole('tab', { name: /^크리에이터/ }).getAttribute('aria-selected'), 'true')
  // 크리에이터만 볼 때는 이벤트를 함께 보여주지 않는다.
  assert.equal(await page.getByText('나래 팬미팅').count(), 0)
  assert.equal(await page.getByText('나래 굿즈 증정').count(), 0)

  await page.getByRole('tab', { name: /^전체/ }).click()
  await waitWhere(page, `/explore/search?q=${encodeURIComponent('나')}&type=all`)
  await page.getByText('나래 팬미팅').waitFor()
  assert.ok(await page.getByText('나래').count() >= 2)

  await page.getByRole('tab', { name: /^이벤트/ }).click()
  await waitWhere(page, `/explore/search?q=${encodeURIComponent('나')}&type=event`)
  await page.getByText('나래 굿즈 증정').waitFor()
  assert.equal(await page.getByText('나래 소개').count(), 0)
  await page.close()
})

test('이벤트 탭에서 검색하면 이벤트 결과가 열리고 뒤로 가면 이벤트 탭과 검색어가 남는다', async () => {
  const page = await screen('/explore?tab=event')
  await page.getByText('다온 팬미팅').waitFor()

  await search(page, '팬미팅')
  await waitWhere(page, `/explore/search?q=${encodeURIComponent('팬미팅')}&type=event`)
  await page.getByText('나래 팬미팅').waitFor()
  assert.equal(await page.getByText('나래 굿즈 증정').count(), 0)

  await page.evaluate(() => window.goBack())
  await waitWhere(page, `/explore?tab=event&q=${encodeURIComponent('팬미팅')}`)
  assert.equal(await page.getByRole('tab', { name: '이벤트' }).getAttribute('aria-selected'), 'true')
  assert.equal(await page.getByRole('searchbox').inputValue(), '팬미팅')
  await page.close()
})

test('탐색에 들어와도 맞춤 추천 API는 부르지 않고, 추천 화면에 들어갈 때 처음 부른다', async () => {
  const page = await screen()
  await page.getByText('다온').first().waitFor()
  assert.equal(await count(page, '/api/me/creator-recommendations'), 0)

  await page.getByRole('link', { name: /맞춤 추천 보기/ }).click()
  await waitWhere(page, '/explore/recommend')
  await page.getByText('하늘').first().waitFor()
  assert.equal(await count(page, '/api/me/creator-recommendations'), 1)
  await page.close()
})

test('검색 결과가 없으면 안내를 보이고, 목록 조회가 실패하면 다시 시도로 결과를 받는다', async () => {
  const empty = await screen(`/explore/search?q=${encodeURIComponent('없는이름')}&type=all`)
  await empty.getByText("'없는이름'에 맞는 결과가 없어요.").waitFor()
  await empty.close()

  const page = await screen(`/explore/search?q=${encodeURIComponent('나')}&type=creator`, {
    failures: { '/api/creators': 1 },
  })
  await page.getByRole('button', { name: '다시 시도' }).waitFor()
  assert.equal(await count(page, '/api/creators'), 1)
  assert.equal(await page.evaluate(() => window.failures['/api/creators']), 0)
  assert.equal(await page.getByText('나래').count(), 0)

  await page.getByRole('button', { name: '다시 시도' }).click()
  await page.getByText('나래').first().waitFor()
  assert.equal(await count(page, '/api/creators'), 2)
  await page.close()
})

/** 요소의 글자색과, 투명한 배경을 위로 따라 올라가며 합성한 배경색의 명암 대비(WCAG)를 잰다. */
const contrastOf = (page, selector) => page.evaluate((query) => {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const context = canvas.getContext('2d', { willReadFrequently: true })
  const rgba = (value) => {
    context.clearRect(0, 0, 1, 1)
    context.fillStyle = '#000'
    context.fillStyle = value
    context.fillRect(0, 0, 1, 1)
    const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data
    return [r, g, b, a / 255]
  }
  const over = (top, bottom) => top.slice(0, 3).map((channel, index) => Math.round(channel * top[3] + bottom[index] * (1 - top[3])))
  const element = document.querySelector(query)
  if (!element) return { found: false }
  let background = [0, 0, 0]
  const layers = []
  for (let node = element; node; node = node.parentElement) {
    const color = rgba(getComputedStyle(node).backgroundColor)
    if (color[3] > 0) layers.push(color)
    if (color[3] === 1) break
  }
  for (const layer of layers.reverse()) background = over(layer, background)
  const text = rgba(getComputedStyle(element).color)
  const flat = over(text, background)
  const luminance = ([r, g, b]) => [r, g, b].map((value) => { const unit = value / 255; return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4 })
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0)
  const [high, low] = [luminance(flat), luminance(background)].sort((x, y) => y - x)
  const box = element.getBoundingClientRect()
  return { found: true, ratio: (high + 0.05) / (low + 0.05), visible: box.width > 0 && box.height > 0 }
}, selector)

for (const theme of ['dark', 'light']) {
  test(`${theme === 'dark' ? '다크' : '라이트'} 모드에서 검색·필터·정렬 메뉴가 보이고 글씨 대비가 충분하다`, async () => {
    const page = await screen()
    await page.evaluate((name) => { document.documentElement.dataset.theme = name }, theme)
    await page.getByRole('searchbox').waitFor()
    await page.getByRole('button', { name: '정렬' }).click()
    await page.getByRole('menu').waitFor()
    // 색은 transition-colors로 서서히 바뀌므로 전환이 끝난 뒤에 잰다.
    await page.waitForTimeout(500)

    // 글씨가 놓이는 곳별 최소 대비. 일반 글씨 4.5, 큰 글씨·보조 문구는 3.
    const targets = {
      '검색창 입력 글씨': ['input[type=search]', 3],
      '탭 선택': ['[role=tab][aria-selected=true]', 4.5],
      '필터 칩(선택)': ['[aria-label="크리에이터 목록 필터"] button[aria-pressed=true]', 4.5],
      '필터 칩(비선택)': ['[aria-label="크리에이터 목록 필터"] button[aria-pressed=false]', 4.5],
      '정렬 메뉴 항목': ['[role=menuitemradio][aria-checked=false]', 4.5],
      '정렬 메뉴 선택 항목': ['[role=menuitemradio][aria-checked=true]', 4.5],
    }
    const failures = []
    for (const [label, [selector, minimum]] of Object.entries(targets)) {
      const result = await contrastOf(page, selector)
      if (!result.found || !result.visible) failures.push(`${label}: 보이지 않음`)
      else if (result.ratio < minimum) failures.push(`${label}: 대비 ${result.ratio.toFixed(2)} < ${minimum}`)
    }
    assert.deepEqual(failures, [])
    await page.close()
  })
}

test('이벤트 상태별 개수 API가 있으면 한 번의 요청으로 칩 개수를 채우고, 없으면 상태별 호출로 대체한다', async () => {
  const counts = { total: 46, upcoming: 5, inProgress: 28, closed: 13 }
  const served = await screen('/explore?tab=event', { counts })
  await served.getByRole('button', { name: /^진행 중 28$/ }).waitFor()
  await served.getByRole('button', { name: /^전체 46$/ }).waitFor()
  assert.equal(await count(served, '/api/events/counts'), 1)
  await served.close()

  // 목에 counts가 없으면 404라 대체 호출이다. 칩은 목록 길이로 채워진다.
  const fallback = await screen('/explore?tab=event')
  await fallback.getByRole('button', { name: /^전체 4$/ }).waitFor()
  assert.equal(await count(fallback, '/api/events/counts'), 1)
  await fallback.close()
})

test('검색 전체는 크리에이터와 이벤트를 각각 7개씩 먼저 보이고 더 보기로 늘리며, 대상을 좁히면 전부 보인다', async () => {
  const creators = Array.from({ length: 10 }, (_, index) => creator(index + 1, `검색${index + 1}`))
  const events = Array.from({ length: 10 }, (_, index) => event(2000 + index, (index % 10) + 1, `검색 이벤트 ${index + 1}`))
  const page = await screen(`/explore/search?q=${encodeURIComponent('검색')}&type=all`, { creators, events })
  // 이벤트 카드에도 크리에이터 이름이 보여서, 크리에이터 행(링크) 안의 이름만 센다.
  const names = () => page.locator('a').getByText(/^검색\d+$/).count()
  const titles = () => page.getByText(/^검색 이벤트 \d+$/).count()
  await page.getByRole('button', { name: /크리에이터 더 보기/ }).waitFor()
  assert.equal(await names(), 7)
  assert.equal(await titles(), 7)

  await page.getByRole('button', { name: /크리에이터 더 보기/ }).click()
  assert.equal(await names(), 10)
  assert.equal(await titles(), 7)
  assert.equal(await page.getByRole('button', { name: /크리에이터 더 보기/ }).count(), 0)

  await page.getByRole('button', { name: /이벤트 더 보기/ }).click()
  assert.equal(await titles(), 10)

  // 대상을 이벤트로 좁히면 나눠 보여주지 않고 전부 보인다.
  await page.getByRole('tab', { name: /^이벤트/ }).click()
  await waitWhere(page, `/explore/search?q=${encodeURIComponent('검색')}&type=event`)
  assert.equal(await titles(), 10)
  assert.equal(await page.getByRole('button', { name: /더 보기/ }).count(), 0)
  await page.close()
})

test('이벤트 필터 칩에 상태별 이벤트 개수가 붙는다', async () => {
  const page = await screen('/explore?tab=event')
  await page.getByText('다온 팬미팅').waitFor()
  // 진행 중 3건, 종료 1건, 오픈 예정 0건 → 전체 4건
  const chip = (name) => page.getByRole('button', { name })
  await chip('전체 4').waitFor()
  await chip('진행 중 3').waitFor()
  await chip('오픈 예정 0').waitFor()
  await chip('종료 1').waitFor()
  await page.close()
})

test('크리에이터 필터 칩에 전체·도킹 개수가 붙고 진행 중 칩은 없다', async () => {
  const page = await screen('/explore')
  await page.getByText('다온').first().waitFor()
  // 크리에이터 4명, 도킹 0명
  await page.getByRole('button', { name: '전체 4' }).waitFor()
  await page.getByRole('button', { name: '도킹 0' }).waitFor()
  assert.equal(await page.getByRole('button', { name: /^진행 중/ }).count(), 0)
  await page.close()
})


for(const total of [10,11,25])test(`탐색 크리에이터 ${total}명은 10명씩 더 보기 후 마지막에 접기`,async()=>{
 const creators=Array.from({length:total},(_,i)=>creator(i+1,`테스트${i+1}`))
 const page=await screen('/explore',{creators,events:[]})
 try{
  await page.getByRole('button',{name:`전체 ${total}`,exact:true}).waitFor()
  const rows=()=>page.locator('a').getByText(/^테스트\d+$/).count()
  assert.equal(await rows(),10)
  const more=page.getByRole('button',{name:'더 보기',exact:true})
  if(total===10){assert.equal(await more.count(),0);return}
  for(let shown=10;shown<total;shown+=10){
   await more.click()
   assert.equal(await rows(),Math.min(shown+10,total))
  }
  assert.equal(await more.count(),0)
  await page.getByRole('button',{name:'접기',exact:true}).click()
  assert.equal(await rows(),10)
  assert.equal(await more.count(),1)
  assert.equal(await page.getByRole('button',{name:'접기',exact:true}).count(),0)
  for(let shown=10;shown<total;shown+=10){
   await more.click()
   assert.equal(await rows(),Math.min(shown+10,total))
  }
  assert.equal(await page.getByRole('button',{name:`전체 ${total}`,exact:true}).count(),1)
  await page.getByRole('button',{name:'도킹',exact:true}).first().click()
  await page.getByRole('button',{name:'도킹 1',exact:true}).click()
  assert.equal(await rows(),1)
  assert.equal(await more.count(),0)
  await page.getByRole('button',{name:`전체 ${total}`,exact:true}).click()
  assert.equal(await rows(),10)
  assert.equal(await more.count(),1)
 }finally{await page.close()}
})



test('이벤트 탭의 더 보기·접기 동작은 기존 5개 단위를 유지한다',async()=>{
 const events=Array.from({length:13},(_,i)=>event(3000+i,1,`확장 이벤트 ${i+1}`))
 const page=await screen('/explore?tab=event',{events})
 try{
  const titles=()=>page.getByText(/^확장 이벤트 \d+$/).count()
  await page.getByText('확장 이벤트 1',{exact:true}).waitFor()
  assert.equal(await titles(),5)
  await page.getByRole('button',{name:'더 보기',exact:true}).click()
  await page.getByText('확장 이벤트 10',{exact:true}).waitFor()
  assert.equal(await titles(),10)
  await page.getByRole('button',{name:'더 보기',exact:true}).click()
  await page.getByText('확장 이벤트 13',{exact:true}).waitFor()
  assert.equal(await titles(),13)
  await page.getByRole('button',{name:'접기',exact:true}).click()
  await page.getByRole('button',{name:'더 보기',exact:true}).waitFor()
  assert.equal(await titles(),5)
 }finally{await page.close()}
})


for(const nested of [false,true])test(`크리에이터 접기는 10명으로 줄이고 탐색 맨 위로 이동한다 (nested=${nested})`,async()=>{
 const creators=Array.from({length:25},(_,i)=>creator(i+1,`위치${i+1}`))
 const page=await screen('/explore',{creators,events:[]})
 try{
  await page.setViewportSize({width:430,height:900})
  if(nested)await page.locator('main').evaluate(el=>{el.style.height='600px';el.style.overflowY='auto'})
  await page.getByRole('button',{name:'전체 25',exact:true}).waitFor()
  await page.getByRole('button',{name:'더 보기',exact:true}).click()
  await page.getByRole('button',{name:'더 보기',exact:true}).click()
  const collapse=page.getByRole('button',{name:'접기',exact:true})
  await collapse.scrollIntoViewIfNeeded()
  assert.ok(await page.evaluate(nested=>nested?document.querySelector('main').scrollTop:document.scrollingElement.scrollTop,nested)>0)
  await collapse.click()
  await page.evaluate(()=>new Promise(requestAnimationFrame))
  assert.equal(await page.locator('a').getByText(/^위치\d+$/).count(),10)
  assert.equal(await page.evaluate(nested=>nested?document.querySelector('main').scrollTop:document.scrollingElement.scrollTop,nested),0)
 }finally{await page.close()}
})
