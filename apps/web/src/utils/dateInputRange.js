// 이벤트·일정 날짜 입력이 받는 범위. BE(ServiceDateRange)와 같이 2000~2099년만 받는다.
// datetime-local은 다섯 자리 연도도 입력되고 min·max만으로는 막히지 않는 브라우저가 있어 값도 직접 검사한다.
export const DATE_INPUT_MIN = '2000-01-01T00:00'
export const DATE_INPUT_MAX = '2099-12-31T23:59'
export const DATE_INPUT_RANGE_MESSAGE = '날짜는 2000년부터 2099년 사이로 입력해주세요.'

/** datetime-local 값(YYYY-MM-DDTHH:mm)의 연도가 네 자리이고 2000~2099년인지 확인한다. */
export function isDateInputInRange(value) {
  const match = /^(\d+)-\d{2}-\d{2}T\d{2}:\d{2}/.exec(value ?? '')
  if (!match || match[1].length !== 4) return false
  const year = Number(match[1])
  return year >= 2000 && year <= 2099
}
