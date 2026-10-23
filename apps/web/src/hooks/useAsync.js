import { createUseAsync } from '@cking/shared/useAsync'
import { LOAD_ERROR_MESSAGE, describeError } from '../api/errorMessages.js'

// 조회 화면이 대체 문구를 주지 않으면 공통 조회 실패 문구를 쓴다.
export const useAsync = createUseAsync((error, fallback) => describeError(error, fallback ?? LOAD_ERROR_MESSAGE))
