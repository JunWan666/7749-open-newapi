import { api } from '@/lib/api'

export type KeyQuotaKey = {
  index: number
  masked: string
  /** 1=正常 2=手动禁用 3=自动熔断 */
  status: number
  reason: string
  disabled_at: number
}

export type KeyQuotaChannel = {
  id: number
  name: string
  status: number
  enabled: boolean
  total_keys: number
  usable_keys: number
  auto_disabled_keys: number
  manual_disabled_keys: number
  daily_quota_per_key: number
  cost_per_call: number
  estimated_remaining_calls: number
  keys: KeyQuotaKey[]
}

export async function getKeyQuotaOverview(): Promise<{
  success: boolean
  data?: KeyQuotaChannel[]
  message?: string
}> {
  const res = await api.get('/api/channel/key_quota/overview')
  return res.data
}

export async function updateKeyQuotaGuard(
  channelId: number,
  payload: {
    enabled: boolean
    daily_quota_per_key: number
    cost_per_call: number
  }
): Promise<{ success: boolean; message?: string }> {
  const res = await api.put(`/api/channel/${channelId}/key_quota`, payload)
  return res.data
}

export async function resetKeyQuotaGuard(
  channelId: number
): Promise<{ success: boolean; message?: string }> {
  const res = await api.post(`/api/channel/${channelId}/key_quota/reset`)
  return res.data
}
