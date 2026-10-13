/** 관측된 잔액에서 수동 보정 필요 상태를 구분한다. */
export function ticketResyncState(balance) {
  if (!balance) return 'UNKNOWN'
  if (balance.mysqlBalanceRowExists === false) return 'NO_MYSQL'
  if (balance.mysqlBalanceRowExists !== true) return 'UNKNOWN'
  if (balance.redisKeyExists === false) return 'MISSING_REDIS'
  if (balance.redisKeyExists === true && balance.balanceDifference === 0) return 'MATCHED'
  if (balance.redisKeyExists === true && typeof balance.balanceDifference === 'number' && balance.balanceDifference !== 0) return 'DIFFERENT'
  return 'UNKNOWN'
}

/** 처음 관측한 잔액과 제출 전 재조회한 잔액이 달라졌는지 확인한다. */
export function ticketBalanceChanged(previous, current) {
  return ['redisBalance', 'mysqlBalance', 'redisKeyExists', 'mysqlBalanceRowExists', 'balanceDifference']
    .some((key) => previous?.[key] !== current?.[key])
}

/** 서버의 보정 거부 코드를 운영자가 조치할 수 있는 문구로 바꾼다. */
export function ticketResyncError(error) {
  if (error?.code === 'INVALID_STATE') return '미반영 EARN·SPEND Stream 또는 미해결 Dead Stream이 있어 서버가 보정을 거부했습니다. 해당 메시지를 확인하고 처리한 뒤 잔액을 다시 조회하세요.'
  if (error?.code === 'CONCURRENT_COMMAND') return '같은 대상의 보정이 이미 진행 중입니다. 잠시 후 잔액을 다시 조회하세요.'
  if (error?.code === 'RESOURCE_NOT_FOUND') return '대상 회원의 MySQL 잔액 행을 찾을 수 없습니다. 대상을 다시 확인하세요.'
  return null
}
