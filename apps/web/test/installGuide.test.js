import test from 'node:test'
import assert from 'node:assert/strict'
import { detectInstallEnvironment, getInstallGuide, INSTALL_GUIDE_OPTIONS } from '../src/pwa/installGuide.js'

test('지원 환경의 user agent를 설치 안내 환경으로 판별한다', () => {
  assert.equal(
    detectInstallEnvironment('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) CriOS/120.0 Mobile/15E148 Safari/604.1'),
    'ios-chrome',
  )
  assert.equal(
    detectInstallEnvironment('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile/15E148 Safari/604.1'),
    'ios-safari',
  )
  assert.equal(
    detectInstallEnvironment('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36'),
    'android-chrome',
  )
  assert.equal(
    detectInstallEnvironment('Mozilla/5.0 (Linux; Android 14) SamsungBrowser/24.0 Chrome/117.0 Mobile Safari/537.36'),
    'android-samsung-internet',
  )
})

test('판별할 수 없는 환경은 선택 UI로 넘기고 모든 설치 절차를 제공한다', () => {
  assert.equal(detectInstallEnvironment('Mozilla/5.0 (X11; Linux x86_64) Firefox/121.0'), null)
  assert.equal(getInstallGuide('unsupported'), null)
  assert.equal(INSTALL_GUIDE_OPTIONS.length, 4)
  assert.deepEqual(getInstallGuide('ios-safari').steps, ['공유', '홈 화면에 추가', '웹 앱으로 열기', '추가'])
})
