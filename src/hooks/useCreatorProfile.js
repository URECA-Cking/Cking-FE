import { useMemo } from 'react'
import { useAsync } from './useAsync.js'
import { getCreatorCatalog, getCreatorProfileById } from '../api/creators.js'

const unknownCreator = { name: '크리에이터', avatar: null, handle: '', bio: '' }

export function useCreatorProfile(creatorId) {
  const id = Number(creatorId)
  const { data } = useAsync(
    () => getCreatorProfileById(id),
    [id],
    { enabled: Number.isInteger(id) && id > 0 },
  )
  return data?.creatorId === id ? data : unknownCreator
}

export function useCreatorCatalog() {
  const { data } = useAsync(() => getCreatorCatalog(), [])
  return useMemo(
    () => new Map((data ?? []).map((creator) => [creator.creatorId, creator])),
    [data],
  )
}
