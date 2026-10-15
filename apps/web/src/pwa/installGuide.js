const IOS_SAFARI = 'ios-safari'
const IOS_CHROME = 'ios-chrome'
const ANDROID_CHROME = 'android-chrome'
const ANDROID_SAMSUNG_INTERNET = 'android-samsung-internet'
const ANDROID_IN_APP = 'android-in-app'

/** 홈 화면 설치 절차를 환경별로 모아 둔 화면 표시용 데이터다. */
export const INSTALL_GUIDES = Object.freeze({
  [IOS_SAFARI]: {
    id: IOS_SAFARI,
    label: 'iPhone/iPad Safari',
    steps: ['공유', '홈 화면에 추가', '웹 앱으로 열기', '추가'],
    note: '메뉴 이름이나 위치는 브라우저 버전에 따라 조금 다를 수 있어요.',
  },
  [IOS_CHROME]: {
    id: IOS_CHROME,
    label: 'iPhone/iPad Chrome',
    steps: ['공유', '홈 화면에 추가', '추가'],
    note: '메뉴 이름이나 위치는 브라우저 버전에 따라 조금 다를 수 있어요.',
  },
  [ANDROID_CHROME]: {
    id: ANDROID_CHROME,
    label: 'Android Chrome',
    steps: ['⋮ 메뉴', '설치 또는 바로가기 만들기', '설치'],
    note: '메뉴 이름이나 위치는 브라우저 버전에 따라 조금 다를 수 있어요.',
  },
  [ANDROID_SAMSUNG_INTERNET]: {
    id: ANDROID_SAMSUNG_INTERNET,
    label: 'Android 삼성 인터넷',
    steps: ['설치 아이콘 또는 메뉴', '홈 화면에 추가'],
    note: '메뉴 이름이나 위치는 브라우저 버전에 따라 조금 다를 수 있어요.',
  },
  [ANDROID_IN_APP]: {
    id: ANDROID_IN_APP,
    label: 'Android 앱 내 브라우저',
    steps: ['앱 메뉴', '다른 브라우저 또는 기본 브라우저로 열기', 'Chrome 또는 삼성 인터넷에서 설치'],
    note: '앱마다 메뉴 이름이나 위치가 다를 수 있어요.',
  },
})

/** 전달값을 안전하게 user agent 비교용 소문자 문자열로 바꾼다. */
function normalizeUserAgent(userAgent) {
  return String(userAgent ?? '').toLowerCase()
}

/** Android 앱 내 브라우저 또는 WebView 표식을 찾아 외부 브라우저 안내 대상으로 판별한다. */
function isAndroidInAppBrowser(agent) {
  return /kakaotalk|naver|\bwv\b|version\/4\.0/.test(agent)
}

/** user agent가 홈 화면 설치 안내를 보여 줄 모바일 기기인지 판별한다. */
export function isMobileDevice(userAgent = '') {
  return /android|iphone|ipad|ipod/.test(normalizeUserAgent(userAgent))
}

/** user agent에서 홈 화면 설치 안내를 지원하는 환경을 판별한다. */
export function detectInstallEnvironment(userAgent = '') {
  const agent = normalizeUserAgent(userAgent)
  const isIos = /iphone|ipad|ipod/.test(agent)

  if (isIos && /crios/.test(agent)) return IOS_CHROME
  if (isIos && /safari/.test(agent) && !/fxios|edgios|opios/.test(agent)) return IOS_SAFARI
  if (/android/.test(agent) && isAndroidInAppBrowser(agent)) return ANDROID_IN_APP
  if (/android/.test(agent) && /samsungbrowser/.test(agent)) return ANDROID_SAMSUNG_INTERNET
  if (/android/.test(agent) && /chrome/.test(agent)) return ANDROID_CHROME
  return null
}

/** 선택하거나 감지한 환경의 설치 절차를 반환한다. */
export function getInstallGuide(environment) {
  return INSTALL_GUIDES[environment] ?? null
}
