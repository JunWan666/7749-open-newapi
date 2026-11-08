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

export type GroupQrcodeMeta = {
  exists: boolean
  expires_at: string
  updated_at: number
}

export async function getGroupQrcodeMeta(): Promise<{
  success: boolean
  data?: GroupQrcodeMeta
}> {
  const res = await api.get('/api/option/group-qrcode/meta')
  return res.data
}

export async function uploadGroupQrcode(
  file: File,
  expiresAt?: string
): Promise<{ success: boolean; message?: string }> {
  const form = new FormData()
  form.append('file', file)
  if (expiresAt) {
    form.append('expires_at', expiresAt)
  }
  const res = await api.post('/api/option/group-qrcode', form)
  return res.data
}

export async function deleteGroupQrcode(): Promise<{
  success: boolean
  message?: string
}> {
  const res = await api.delete('/api/option/group-qrcode')
  return res.data
}
