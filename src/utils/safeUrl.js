/**
 * 사용자가 입력한 URL을 <a href>에 넣어도 안전한 http(s) 주소로만 통과시킨다. 아니면 null.
 * javascript:·data: 같은 스킴은 클릭하는 순간 앱 출처에서 스크립트가 실행되므로 링크로 그리지 않는다.
 * 스킴이 없는 값("example.com")은 브라우저가 현재 주소 기준 상대 경로로 해석해 어차피 깨진 링크가 되므로 null이다.
 */
export function toSafeHttpUrl(value) {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}
