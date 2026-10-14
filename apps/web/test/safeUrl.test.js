import test from 'node:test'
import assert from 'node:assert/strict'
import { toSafeImageUrl } from '../src/utils/safeUrl.js'

test('이미지는 http(s) 주소와 업로드 미리보기 blob 주소만 표시한다', () => {
  assert.equal(toSafeImageUrl(' https://cdn.example.com/a.png '), 'https://cdn.example.com/a.png')
  assert.equal(toSafeImageUrl('http://localhost:5173/a.png'), 'http://localhost:5173/a.png')
  assert.equal(toSafeImageUrl('blob:https://example.com/123'), 'blob:https://example.com/123')
  for (const value of [null, '', '/image.png', 'javascript:alert(1)', 'data:image/svg+xml,<svg/>', 'file:///a.png']) {
    assert.equal(toSafeImageUrl(value), null)
  }
})
