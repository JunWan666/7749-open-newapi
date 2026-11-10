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

export type NoticeBlock = {
  title: string
  description: string
  steps: string[]
  footer: string
  note: string
}

export type NoticeContact = {
  name: string
  role: string
  avatar: string
}

export type NoticeConfigData = {
  pending: NoticeBlock
  restricted: NoticeBlock
  contacts: NoticeContact[]
}

export async function getNoticeConfig(): Promise<{
  success: boolean
  data?: NoticeConfigData
}> {
  const res = await api.get('/api/option/notice-config')
  return res.data
}

export async function saveNoticeConfig(
  config: NoticeConfigData
): Promise<{ success: boolean; message?: string }> {
  const res = await api.put('/api/option/notice-config', config)
  return res.data
}
