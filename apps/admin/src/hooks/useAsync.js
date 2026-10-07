import { createUseAsync } from '@cking/shared/useAsync'
import { describeError } from '../api/client.js'

export const useAsync = createUseAsync(describeError)
