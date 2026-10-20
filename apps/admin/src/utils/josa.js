const DIGITS_WITH_FINAL_CONSONANT = new Set(['0', '1', '3', '6', '7', '8'])

/**
 * 마지막 글자의 받침에 맞춰 목적격 조사 "을"/"를"을 고른다.
 * 한글과 숫자(읽는 소리 기준)만 판별하고, 그 밖의 글자로 끝나면 알 수 없어 "을(를)"로 둔다.
 * 끝의 따옴표·괄호 같은 기호는 건너뛰고 판별한다.
 */
export function objectParticle(text) {
  const last = [...String(text ?? '').trimEnd()].reverse().find((char) => /[\p{L}\p{N}]/u.test(char))
  if (!last) return '을(를)'
  const code = last.charCodeAt(0)
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 === 0 ? '를' : '을'
  if (/[0-9]/.test(last)) return DIGITS_WITH_FINAL_CONSONANT.has(last) ? '을' : '를'
  return '을(를)'
}
