import { api } from '@/lib/api'

export type KeyQuotaKey = {
  index: number
  masked: string
  /** 1=正常 2=手动禁用 3=自动熔断 */
  status: number
  reason: string
  disabled_at: number
  balance: number
  balance_at: number
  balance_error: string
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
  balance_sum: number
  balance_updated_at: number
  probe_enabled: boolean
  probe_interval_minutes: number
  keys?: KeyQuotaKey[]
}

export type KeyQuotaKeyStatus = 'all' | 'available' | 'auto' | 'manual'

export type KeyQuotaKeysPage = {
  items: KeyQuotaKey[]
  total: number
  page: number
  page_size: number
  summary: KeyQuotaChannel
}

export async function getKeyQuotaOverview(): Promise<{
  success: boolean
  data?: KeyQuotaChannel[]
  message?: string
}> {
  const res = await api.get('/api/channel/key_quota/overview')
  return res.data
}

export async function getKeyQuotaKeys(params: {
  channelId: number
  page: number
  pageSize: number
  status: KeyQuotaKeyStatus
  keyword: string
}): Promise<{ success: boolean; data?: KeyQuotaKeysPage; message?: string }> {
  const res = await api.get(`/api/channel/${params.channelId}/key_quota/keys`, {
    params: {
      page: params.page,
      page_size: params.pageSize,
      status: params.status,
      keyword: params.keyword,
    },
  })
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

export async function updateKeyBalanceProbe(
  channelId: number,
  payload: { enabled: boolean; interval_minutes: number }
): Promise<{ success: boolean; message?: string }> {
  const res = await api.put(`/api/channel/${channelId}/key_quota/probe`, payload)
  return res.data
}

export async function probeKeyBalances(
  channelId: number,
  index?: number
): Promise<{ success: boolean; message?: string }> {
  const res = await api.post(
    `/api/channel/${channelId}/key_quota/probe`,
    index === undefined ? {} : { index }
  )
  return res.data
}

export async function resetKeyQuotaGuard(
  channelId: number
): Promise<{ success: boolean; message?: string }> {
  const res = await api.post(`/api/channel/${channelId}/key_quota/reset`)
  return res.data
}
