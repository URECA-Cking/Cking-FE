const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_ATTEMPTS = 16

/** 현재 폼에서 사용했거나 삭제한 키도 예약해 두고 신규 행에만 발급한다. */
export function allocatePrizeKey(reservedKeys, nextId) {
  const used = new Set([...reservedKeys].map(key => key.toLowerCase()))
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const id = nextId()
    if (typeof id !== 'string' || !UUID.test(id)) continue
    const key = `PRIZE_${id}`
    if (used.has(key.toLowerCase())) continue
    reservedKeys.add(key.toLowerCase())
    return key
  }
  throw new Error('상품을 추가하지 못했어요. 다시 시도해 주세요.')
}
