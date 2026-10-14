const IOS_SAFARI = 'ios-safari'
const IOS_CHROME = 'ios-chrome'
const ANDROID_CHROME = 'android-chrome'
const ANDROID_SAMSUNG_INTERNET = 'android-samsung-internet'

/** 홈 화면 설치 절차를 환경별로 모아 둔 화면 표시용 데이터다. */
export const INSTALL_GUIDES = Object.freeze({
  [IOS_SAFARI]: {
    id: IOS_SAFARI,
    label: 'iPhone/iPad Safari',
    steps: ['공유', '홈 화면에 추가', '웹 앱으로 열기', '추가'],
  },
  [IOS_CHROME]: {
    id: IOS_CHROME,
    label: 'iPhone/iPad Chrome',
    steps: ['공유', '홈 화면에 추가', '추가'],
  },
  [ANDROID_CHROME]: {
    id: ANDROID_CHROME,
    label: 'Android Chrome',
    steps: ['⋮ 메뉴', '설치 또는 바로가기 만들기', '설치'],
  },
  [ANDROID_SAMSUNG_INTERNET]: {
    id: ANDROID_SAMSUNG_INTERNET,
    label: 'Android 삼성 인터넷',
    steps: ['설치 아이콘 또는 메뉴', '홈 화면에 추가'],
  },
})

/** 사용자가 직접 선택할 수 있도록 지원 환경 목록을 순서대로 제공한다. */
export const INSTALL_GUIDE_OPTIONS = Object.freeze(Object.values(INSTALL_GUIDES))

/** user agent에서 홈 화면 설치 안내를 지원하는 환경을 판별한다. */
export function detectInstallEnvironment(userAgent = '') {
  const agent = userAgent.toLowerCase()
  const isIos = /iphone|ipad|ipod/.test(agent)

  if (isIos && /crios/.test(agent)) return IOS_CHROME
  if (isIos && /safari/.test(agent) && !/fxios|edgios|opios/.test(agent)) return IOS_SAFARI
  if (/android/.test(agent) && /samsungbrowser/.test(agent)) return ANDROID_SAMSUNG_INTERNET
  if (/android/.test(agent) && /chrome|crios/.test(agent)) return ANDROID_CHROME
  return null
}

/** 선택하거나 감지한 환경의 설치 절차를 반환한다. */
export function getInstallGuide(environment) {
  return INSTALL_GUIDES[environment] ?? null
}
