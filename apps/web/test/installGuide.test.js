import test from 'node:test'
import assert from 'node:assert/strict'
import { detectInstallEnvironment, getInstallGuide, isMobileDevice } from '../src/pwa/installGuide.js'

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
  assert.equal(
    detectInstallEnvironment('Mozilla/5.0 (Linux; Android 14; SM-S901N) AppleWebKit/537.36 KAKAOTALK 2409000 Chrome/120.0 Mobile Safari/537.36'),
    'android-in-app',
  )
  assert.equal(
    detectInstallEnvironment('Mozilla/5.0 (Linux; Android 14; SM-S901N) NAVER(inapp; search; 2000; 13.0.0) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36'),
    'android-in-app',
  )
})

test('판별할 수 없는 환경은 설치 절차를 만들지 않고 안전하게 처리한다', () => {
  assert.equal(detectInstallEnvironment('Mozilla/5.0 (X11; Linux x86_64) Firefox/121.0'), null)
  assert.equal(
    detectInstallEnvironment('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 CriOS/120.0 Mobile Safari/537.36'),
    null,
  )
  assert.equal(detectInstallEnvironment(null), null)
  assert.equal(getInstallGuide('unsupported'), null)
  assert.deepEqual(getInstallGuide('ios-safari').steps, ['공유', '홈 화면에 추가', '웹 앱으로 열기', '추가'])
})

test('설치 안내는 모바일만 대상으로 하고 Android 인앱 브라우저는 외부 브라우저 안내를 쓴다', () => {
  assert.equal(isMobileDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0'), false)
  assert.equal(isMobileDevice('Mozilla/5.0 (Linux; Android 14) Chrome/120.0 Mobile Safari/537.36'), true)
  assert.deepEqual(getInstallGuide('android-in-app').steps, [
    '앱 메뉴',
    '다른 브라우저 또는 기본 브라우저로 열기',
    'Chrome 또는 삼성 인터넷에서 설치',
  ])
})
