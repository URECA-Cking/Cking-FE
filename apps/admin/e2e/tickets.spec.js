import { expect, test } from '@playwright/test'

const loginId = process.env.E2E_ADMIN_LOGIN_ID
const password = process.env.E2E_ADMIN_PASSWORD
const apiHost = new URL(process.env.E2E_ADMIN_API_BASE_URL || 'https://dev-api.cking.co.kr').hostname
const readMemberId = process.env.E2E_TICKET_READ_MEMBER_ID
const readCreatorId = process.env.E2E_TICKET_READ_CREATOR_ID
const blockedMemberId = process.env.E2E_TICKET_BLOCKED_MEMBER_ID
const blockedCreatorId = process.env.E2E_TICKET_BLOCKED_CREATOR_ID
const resyncMemberId = process.env.E2E_TICKET_RESYNC_MEMBER_ID
const resyncCreatorId = process.env.E2E_TICKET_RESYNC_CREATOR_ID
const mutationReady = process.env.E2E_TICKET_MUTATION_READY === '1'

/** 지정한 종류와 대상의 실제 관리자 API 응답만 기다린다. */
function waitForTicketResponse(page, path, scope, method = 'GET') {
  return page.waitForResponse((response) => {
    const url = new URL(response.url())
    return (url.hostname === apiHost || url.hostname === new URL(page.url()).hostname)
      && url.pathname === path && response.request().method() === method
      && (method === 'POST' || (url.searchParams.get('memberId') === scope.memberId
        && url.searchParams.get('couponType') === scope.couponType
        && url.searchParams.get('creatorId') === (scope.creatorId ?? null)))
  })
}

/** 관리자 계정으로 로그인한 뒤 응모권 관리 메뉴로 이동한다. */
async function openTicketPage(page) {
  await page.goto('/login')
  await page.getByLabel('관리자 ID').fill(loginId)
  await page.getByLabel('비밀번호').fill(password)
  await page.getByRole('button', { name: '로그인' }).click()
  await expect(page).toHaveURL(/\/admin$/)
  await page.getByRole('link', { name: '응모권 관리' }).first().click()
  await expect(page).toHaveURL(/\/admin\/tickets$/)
  await expect(page.getByRole('heading', { name: '응모권 관리' })).toBeVisible()
}

/** 화면에서 대상 응모권을 조회하고 잔액·이력의 실제 응답을 돌려준다. */
async function searchTickets(page, scope) {
  await page.getByLabel('회원 ID').fill(scope.memberId)
  await page.getByLabel('응모권 종류').selectOption(scope.couponType)
  if (scope.creatorId) await page.getByLabel(/Creator ID/).fill(scope.creatorId)
  const balancePromise = waitForTicketResponse(page, '/api/admin/tickets/balance', scope)
  const historyPromise = waitForTicketResponse(page, '/api/admin/tickets/history', scope)
  await page.getByRole('button', { name: '조회', exact: true }).click()
  const [balanceResponse, historyResponse] = await Promise.all([balancePromise, historyPromise])
  expect(balanceResponse.status()).toBe(200)
  expect(historyResponse.status()).toBe(200)
  const balance = (await balanceResponse.json()).data
  const history = (await historyResponse.json()).data
  await expect(page.getByText(scope.couponType === 'CREATOR' ? `Creator #${scope.creatorId}` : '공용 응모권').first()).toBeVisible()
  return { balance, history }
}

/** 보정 요청 전에 자동 재조회 대기를 등록하고 확인창에서 요청을 실행한다. */
async function submitResync(page, scope, reason, expectHistoryReload = false) {
  await page.getByRole('button', { name: '수동 재동기화' }).click()
  const dialog = page.getByRole('dialog', { name: '수동 재동기화 확인' })
  await dialog.getByLabel(/보정 사유/).fill(reason)
  const freshBalancePromise = waitForTicketResponse(page, '/api/admin/tickets/balance', scope)
  await dialog.getByRole('button', { name: '최신 잔액 확인' }).click()
  const freshResponse = await freshBalancePromise
  expect(freshResponse.status()).toBe(200)
  const freshBalance = (await freshResponse.json()).data
  expect(freshBalance.redisKeyExists).toBe(true)
  expect(freshBalance.mysqlBalanceRowExists).toBe(true)
  expect(freshBalance.balanceDifference).toEqual(expect.any(Number))
  expect(freshBalance.balanceDifference).not.toBe(0)
  await dialog.getByLabel('최신 잔액과 불일치 원인을 확인했습니다.').check()
  const path = scope.couponType === 'CREATOR' ? '/api/admin/tickets/resync' : '/api/admin/tickets/common/resync'
  const resyncPromise = waitForTicketResponse(page, path, scope, 'POST')
  const balanceReloadPromise = waitForTicketResponse(page, '/api/admin/tickets/balance', scope)
  const historyReloadPromise = expectHistoryReload
    ? waitForTicketResponse(page, '/api/admin/tickets/history', scope)
    : null
  await dialog.getByRole('button', { name: '재동기화 요청' }).click()
  return { resyncPromise, balanceReloadPromise, historyReloadPromise }
}

test.describe('TC-08 관리자 응모권 E2E', () => {
  test.skip(!loginId || !password, '관리자 E2E 계정이 필요합니다.')

  test('Creator 전용·공용 잔액과 적립·사용 이력을 조회한다', async ({ page }) => {
    test.skip(!readMemberId || !readCreatorId, '조회 대상 회원·Creator ID가 필요합니다.')
    await openTicketPage(page)
    for (const scope of [
      { memberId: readMemberId, couponType: 'CREATOR', creatorId: readCreatorId },
      { memberId: readMemberId, couponType: 'COMMON' },
    ]) {
      const { balance, history } = await searchTickets(page, scope)
      expect(balance.redisKeyExists).toBe(true)
      expect(balance.mysqlBalanceRowExists).toBe(true)
      expect(balance.redisBalance).toEqual(expect.any(Number))
      expect(balance.mysqlBalance).toEqual(expect.any(Number))
      expect(history.items.map((item) => item.type)).toEqual(expect.arrayContaining(['EARN', 'SPEND']))
      await expect(page.getByText('적립', { exact: true }).first()).toBeVisible()
      await expect(page.getByText('사용', { exact: true }).first()).toBeVisible()
    }
  })

  test('미반영 Stream이 있는 대상의 보정을 거부한다', async ({ page }) => {
    test.skip(!mutationReady || !blockedMemberId || !blockedCreatorId, '거부 시나리오의 격리된 테스트 데이터와 실행 표시가 필요합니다.')
    test.skip(blockedMemberId === readMemberId || blockedMemberId === resyncMemberId, '조회·거부·보정 대상 회원은 달라야 합니다.')
    await openTicketPage(page)
    const scope = { memberId: blockedMemberId, couponType: 'CREATOR', creatorId: blockedCreatorId }
    const before = await searchTickets(page, scope)
    expect(before.balance.redisKeyExists).toBe(true)
    expect(before.balance.mysqlBalanceRowExists).toBe(true)
    expect(before.balance.balanceDifference).toEqual(expect.any(Number))
    expect(before.balance.balanceDifference).not.toBe(0)
    await expect(page.getByText('차이 있음')).toBeVisible()
    const { resyncPromise, balanceReloadPromise } = await submitResync(page, scope, `TC-08 미반영 Stream 거부 검증 ${Date.now()}`)
    const response = await resyncPromise
    expect(response.status()).toBe(409)
    expect((await response.json()).code).toBe('INVALID_STATE')
    await expect(page.getByRole('alert').filter({ hasText: '미반영 EARN·SPEND Stream' })).toBeVisible()
    const balanceResponse = await balanceReloadPromise
    expect(balanceResponse.status()).toBe(200)
    const afterBalance = (await balanceResponse.json()).data
    const afterHistoryPromise = waitForTicketResponse(page, '/api/admin/tickets/history', scope)
    await page.getByRole('button', { name: '취소' }).click()
    await page.getByRole('button', { name: '이력 새로고침' }).click()
    const historyResponse = await afterHistoryPromise
    expect(historyResponse.status()).toBe(200)
    const afterHistory = (await historyResponse.json()).data
    expect(afterBalance.redisBalance).toBe(before.balance.redisBalance)
    expect(afterBalance.mysqlBalance).toBe(before.balance.mysqlBalance)
    expect(afterHistory.items.map((item) => item.ledgerId)).toEqual(before.history.items.map((item) => item.ledgerId))
  })

  test('안전한 조건에서 Creator 전용·공용 응모권을 보정하고 재검증한다', async ({ page }) => {
    test.skip(!mutationReady || !resyncMemberId || !resyncCreatorId, '보정 시나리오의 격리된 테스트 데이터와 실행 표시가 필요합니다.')
    test.skip(resyncMemberId === blockedMemberId || resyncMemberId === readMemberId, '조회·거부·보정 대상 회원은 달라야 합니다.')
    await openTicketPage(page)
    for (const scope of [
      { memberId: resyncMemberId, couponType: 'CREATOR', creatorId: resyncCreatorId },
      { memberId: resyncMemberId, couponType: 'COMMON' },
    ]) {
      const before = await searchTickets(page, scope)
      expect(before.balance.redisKeyExists).toBe(true)
      expect(before.balance.mysqlBalanceRowExists).toBe(true)
      expect(before.balance.balanceDifference).toEqual(expect.any(Number))
      expect(before.balance.balanceDifference).not.toBe(0)
      const reason = `TC-08 ${scope.couponType} 보정 검증 ${Date.now()}`
      const { resyncPromise, balanceReloadPromise, historyReloadPromise } = await submitResync(page, scope, reason, true)
      const response = await resyncPromise
      expect(response.status()).toBe(200)
      expect((await response.json()).code).toBe('SUCCESS')
      const balanceResponse = await balanceReloadPromise
      const historyResponse = await historyReloadPromise
      expect(balanceResponse.status()).toBe(200)
      expect(historyResponse.status()).toBe(200)
      const balance = (await balanceResponse.json()).data
      const history = (await historyResponse.json()).data
      expect(balance.redisBalance).toBe(balance.mysqlBalance)
      expect(balance.balanceDifference).toBe(0)
      expect(history.items).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'COMPENSATE', reason })]))
      await expect(page.getByText('일치', { exact: true })).toBeVisible()
      await expect(page.getByText(reason)).toBeVisible()
    }
  })
})
