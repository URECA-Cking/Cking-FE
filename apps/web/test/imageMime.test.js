import assert from 'node:assert/strict'
import test from 'node:test'
import { isSupportedJpegOrPng } from '../src/utils/imageMime.js'

test('JPEG와 PNG MIME type은 파일명과 무관하게 허용한다', () => {
  assert.equal(isSupportedJpegOrPng({ name: 'photo', type: 'image/jpeg' }), true)
  assert.equal(isSupportedJpegOrPng({ name: 'photo', type: 'image/png' }), true)
})

test('빈 MIME type 또는 octet-stream인 JPEG와 PNG는 확장자로 보조 판정한다', () => {
  assert.equal(isSupportedJpegOrPng({ name: 'desktop.PNG', type: '' }), true)
  assert.equal(isSupportedJpegOrPng({ name: 'desktop.jpg', type: 'application/octet-stream' }), true)
  assert.equal(isSupportedJpegOrPng({ name: 'desktop.JPEG', type: ' APPLICATION/OCTET-STREAM ' }), true)
})

test('지원하지 않는 MIME type과 안전하지 않은 파일명은 거부한다', () => {
  assert.equal(isSupportedJpegOrPng({ name: 'capture.png', type: 'image/gif' }), false)
  assert.equal(isSupportedJpegOrPng({ name: 'capture.webp', type: 'image/webp' }), false)
  assert.equal(isSupportedJpegOrPng({ name: 'capture.png.exe', type: '' }), false)
  assert.equal(isSupportedJpegOrPng({ name: 'capture', type: 'application/octet-stream' }), false)
})
