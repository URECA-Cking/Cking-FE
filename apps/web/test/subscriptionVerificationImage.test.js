import test from 'node:test'
import assert from 'node:assert/strict'
import { isSupportedSubscriptionVerificationImage } from '../src/utils/subscriptionVerificationImage.js'

test('정상 JPEG와 PNG MIME type을 허용한다', () => {
  assert.equal(isSupportedSubscriptionVerificationImage({ name: 'capture.jpeg', type: 'image/jpeg' }), true)
  assert.equal(isSupportedSubscriptionVerificationImage({ name: 'capture.png', type: 'image/png' }), true)
})

test('MIME type이 비었거나 octet-stream인 데스크톱 PNG와 JPEG는 확장자로 허용한다', () => {
  assert.equal(isSupportedSubscriptionVerificationImage({ name: 'desktop.PNG', type: '' }), true)
  assert.equal(isSupportedSubscriptionVerificationImage({ name: 'desktop.jpg', type: 'application/octet-stream' }), true)
  assert.equal(isSupportedSubscriptionVerificationImage({ name: 'desktop.JPEG', type: 'APPLICATION/OCTET-STREAM' }), true)
})

test('다른 MIME type이나 이중 확장자는 허용하지 않는다', () => {
  assert.equal(isSupportedSubscriptionVerificationImage({ name: 'capture.png', type: 'image/gif' }), false)
  assert.equal(isSupportedSubscriptionVerificationImage({ name: 'capture.png.exe', type: '' }), false)
  assert.equal(isSupportedSubscriptionVerificationImage({ name: 'capture', type: 'application/octet-stream' }), false)
})
