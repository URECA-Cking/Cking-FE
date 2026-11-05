import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const source = (path) => fileURLToPath(new URL(`../src/${path}`, import.meta.url))

test('신청 보완과 YouTube 연결은 신규 계약의 경로·본문·쿠키를 사용한다', async () => {
  const previousFetch = globalThis.fetch
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom' })
  const { applyCreator, getMyCreatorApplication, resubmitCreatorApplication, updateCreatorApplication } = await server.ssrLoadModule(source('api/creatorApplications.js'))
  const { getMyCreatorStatus } = await server.ssrLoadModule(source('api/creatorStatus.js'))
  const { getYoutubeChannelConnection, startYoutubeChannelConnection } = await server.ssrLoadModule(source('api/subscriptionVerification.js'))
  const requests = []
  globalThis.fetch = async (url, options) => {
    requests.push({ url: new URL(url, 'http://localhost'), options })
    return { ok: true, status: 200, text: async () => JSON.stringify({ code: 'SUCCESS', data: {} }) }
  }
  try {
    const form = { preferredActivityName: '테스트', categoryCodes: ['FOOD'], introduction: '소개', evidenceUrls: ['https://example.com'], activityPlan: '활동', platforms: ['YOUTUBE'], agreeToCreatorPolicy: true }
    await applyCreator(form)
    await getMyCreatorApplication(13)
    await updateCreatorApplication(13, form)
    await resubmitCreatorApplication(13)
    await startYoutubeChannelConnection('@creator')
    await getYoutubeChannelConnection()
    await getMyCreatorStatus()

    assert.deepEqual(requests.map(({ url, options }) => [options.method, url.pathname]), [
      ['POST', '/api/creator/applications'], ['GET', '/api/creator/applications/13'],
      ['PATCH', '/api/creator/applications/13'], ['POST', '/api/creator/applications/13/resubmit'],
      ['POST', '/api/creator/youtube-channel/connections'], ['GET', '/api/creator/youtube-channel/connection'],
      ['GET', '/api/creator/me/status'],
    ])
    assert.deepEqual(JSON.parse(requests[0].options.body), form)
    assert.deepEqual(JSON.parse(requests[2].options.body), form)
    assert.deepEqual(JSON.parse(requests[4].options.body), { channelHandle: '@creator' })
    assert.ok(requests.every(({ options }) => options.credentials === 'include'))
  } finally {
    globalThis.fetch = previousFetch
    await server.close()
  }
})
