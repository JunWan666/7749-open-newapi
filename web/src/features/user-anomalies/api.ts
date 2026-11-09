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
    total_groups: number
    total_idle: number
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
