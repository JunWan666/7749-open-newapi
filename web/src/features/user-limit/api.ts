import { api } from '@/lib/api'

export type UserLimitRule = {
  channel_id: number
  /** 为空表示限制整个渠道 */
  model: string
  daily_calls: number
}

export type UserLimitConfig = {
  enabled: boolean
  rules: UserLimitRule[]
  exempt_users: number[]
}

export type UserLimitChannel = {
  id: number
  name: string
  models: string[]
}

export type UserLimitUsage = {
  rule_label: string
  rule_index: number
  user_id: number
  username: string
  calls: number
  limit: number
}

export async function getUserLimitConfig(): Promise<{
  success: boolean
  data?: {
    config: UserLimitConfig
    channels: UserLimitChannel[]
    usage: UserLimitUsage[]
  }
  message?: string
}> {
  const res = await api.get('/api/option/user-model-limit')
  return res.data
}

export async function saveUserLimitConfig(
  config: UserLimitConfig
): Promise<{ success: boolean; message?: string }> {
  const res = await api.put('/api/option/user-model-limit', config)
  return res.data
}

export type UserSearchItem = {
  id: number
  username: string
  display_name?: string
}

export async function searchUsers(keyword: string): Promise<UserSearchItem[]> {
  const res = await api.get('/api/user/search', {
    params: { keyword, p: 0, page_size: 10 },
  })
  const payload = res.data
  if (!payload?.success) {
    return []
  }
  const data = payload.data
  const items = Array.isArray(data) ? data : (data?.items ?? [])
  return items as UserSearchItem[]
}
