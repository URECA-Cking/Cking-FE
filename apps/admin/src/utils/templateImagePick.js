/**
 * 템플릿 이미지 칸에서 파일을 고른 뒤의 흐름(검증 → 업로드 → 값 반영)이다. 화면과 분리해 두어 흐름을 단위 테스트한다.
 *
 * 파일을 고른 순간부터 끝날 때까지가 처리 중이다. 검증이 끝나기 전에도 `onBusyChange(true)`를 먼저 알려 폼이 저장하지
 * 못하게 하고(저장하면 이전 이미지 URL이 저장된다), 처리 중에 고른 파일은 무시한다(먼저 고른 파일의 결과가 나중 선택을
 * 덮지 않게). `lock`은 렌더 사이에도 유지되는 `{ current: boolean }`이다(state는 다음 렌더까지 늦어 연달아 오는 선택을 못 막는다).
 * 처리를 시작했으면 true, 무시했으면 false를 돌려준다.
 */
export async function pickTemplateImage(file, lock, { validate, upload, describeError, onBusyChange, onMessage, onUploaded }) {
  if (!file || lock.current) return false
  lock.current = true
  onBusyChange(true)
  onMessage('')
  try {
    const invalid = await validate(file)
    if (invalid) {
      onMessage(invalid)
      return true
    }
    const result = await upload(file)
    if (!result?.imageUrl) throw new Error('이미지 주소를 받지 못했습니다.')
    onUploaded(file, result.imageUrl)
  } catch (error) {
    onMessage(describeError(error))
  } finally {
    lock.current = false
    onBusyChange(false)
  }
  return true
}
