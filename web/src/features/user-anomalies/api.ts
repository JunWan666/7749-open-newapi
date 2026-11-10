/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { api } from '@/lib/api'

export type AnomalyUserRow = {
  id: number
  username: string
  status: number
  role: number
  remark: string
  register_ip: string
  last_login_ip: string
  created_at: number
  request_count: number
  total_tokens: number
  quota: number
  used_quota: number
  handle_note?: string
}

export async function getUserAnomalies(): Promise<{
  success: boolean
  data?: {
    ip_groups: Array<{
      ip: string
      accounts: number
      users: Array<AnomalyUserRow>
    }>
    idle_users: Array<AnomalyUserRow & { checkin_days: number }>
    handled_users: AnomalyUserRow[]
    ignored_users: IgnoredAnomalyUser[]
    total_groups: number
    total_idle: number
    total_handled: number
    total_ignored: number
  }
}> {
  const res = await api.get('/api/user/anomalies')
  return res.data
}

export async function updateAnomalyUserStatus(
  id: number,
  status: number
): Promise<{ success: boolean; message?: string }> {
  const res = await api.put(`/api/user/${id}/status`, { status })
  return res.data
}

export type IgnoredAnomalyUser = {
  id: number
  username: string
  status: number
  role: number
  remark: string
  register_ip: string
  last_login_ip: string
  created_at: number
  request_count: number
  total_tokens: number
  quota: number
  used_quota: number
  ignore_reason: string
  ignored_at: number
}

export async function ignoreAnomalyUser(
  userId: number,
  reason?: string
): Promise<{ success: boolean; message?: string }> {
  const res = await api.post('/api/user/anomalies/ignore', {
    user_id: userId,
    reason: reason ?? '',
  })
  return res.data
}

export async function unignoreAnomalyUser(
  userId: number
): Promise<{ success: boolean; message?: string }> {
  const res = await api.delete(`/api/user/anomalies/ignore/${userId}`)
  return res.data
}

export async function updateAnomalyNote(
  userId: number,
  note: string
): Promise<{ success: boolean; message?: string }> {
  const res = await api.put('/api/user/anomalies/note', {
    user_id: userId,
    note,
  })
  return res.data
}

export async function batchUpdateAnomalyStatus(
  userIds: number[],
  status: number
): Promise<{ success: boolean; data?: { updated: number }; message?: string }> {
  const res = await api.post('/api/user/anomalies/batch-status', {
    user_ids: userIds,
    status,
  })
  return res.data
}

export async function batchIgnoreAnomalyUsers(
  userIds: number[]
): Promise<{ success: boolean; data?: { updated: number }; message?: string }> {
  const res = await api.post('/api/user/anomalies/batch-ignore', {
    user_ids: userIds,
  })
  return res.data
}

export async function batchUnignoreAnomalyUsers(
  userIds: number[]
): Promise<{ success: boolean; data?: { updated: number }; message?: string }> {
  const res = await api.post('/api/user/anomalies/batch-unignore', {
    user_ids: userIds,
  })
  return res.data
}

export async function updateAnomalyUserRemark(
  userId: number,
  remark: string
): Promise<{ success: boolean; message?: string }> {
  const res = await api.put(`/api/user/${userId}/remark`, { remark })
  return res.data
}
