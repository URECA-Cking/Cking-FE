export const IMAGE_REUSE_TYPE_META = {
  FIRST_USE: {
    label: '최초 사용',
    tone: 'bg-emerald-50 text-emerald-800',
    description: '이전에 제출된 동일 이미지가 없습니다.',
  },
  SAME_MEMBER_SAME_CREATOR: {
    label: '동일 회원·동일 Creator 재사용',
    tone: 'bg-amber-50 text-amber-800',
    description: '같은 회원이 같은 Creator 인증에 동일 이미지를 다시 제출했습니다.',
  },
  SAME_MEMBER_DIFFERENT_CREATOR: {
    label: '동일 회원·다른 Creator 재사용',
    tone: 'bg-orange-50 text-orange-800',
    description: '같은 회원이 다른 Creator 인증에 동일 이미지를 제출했습니다.',
  },
  DIFFERENT_MEMBER: {
    label: '다른 회원의 이미지 재사용',
    tone: 'bg-red-50 text-red-800',
    description: '다른 회원이 먼저 제출한 이미지와 일치합니다.',
  },
}

/** Verification ID 입력을 양의 안전 정수로만 변환한다. */
export function parseVerificationId(value) {
  const normalized = String(value).trim()
  if (!/^[1-9]\d*$/.test(normalized)) return null
  const verificationId = Number(normalized)
  return Number.isSafeInteger(verificationId) ? verificationId : null
}

/** 서버 Enum을 운영자용 표시 정보로 변환하고 신규 값도 숨기지 않는다. */
export function imageReuseTypeMeta(reuseType) {
  return IMAGE_REUSE_TYPE_META[reuseType] ?? {
    label: reuseType || '알 수 없음',
    tone: 'bg-slate-100 text-slate-700',
    description: '화면에 아직 등록되지 않은 재사용 유형입니다.',
  }
}
