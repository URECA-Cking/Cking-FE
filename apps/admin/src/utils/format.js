export { formatDateTime, formatNumber, totalPrizeQuantity } from '@cking/shared/format'

/** 이름과 옆에 작게 붙일 ID 문구. 이름이 없으면 ID를 이름 자리에 쓰고, 둘 다 없으면 대시다. */
export function nameWithId(name, id) {
  const idLabel = id == null ? null : `#${id}`
  return name == null ? { name: idLabel ?? '-', idLabel: null } : { name, idLabel }
}
