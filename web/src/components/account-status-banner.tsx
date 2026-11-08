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
import { AlertTriangle, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

const STATUS_PENDING = 3
const STATUS_SUSPICIOUS = 4

/**
 * Top banner shown to accounts that are not fully enabled:
 * - pending review: cannot call APIs until an admin approves
 * - suspicious: only the free NVIDIA (ywd/*) models are available
 */
export function AccountStatusBanner() {
  const { t } = useTranslation()
  const status = useAuthStore((state) => state.auth.user?.status)

  if (status !== STATUS_PENDING && status !== STATUS_SUSPICIOUS) {
    return null
  }

  const isPending = status === STATUS_PENDING

  return (
    <div
      className={cn(
        'flex items-start gap-3 border-b px-4 py-2.5',
        isPending
          ? 'bg-info/10 border-info/30'
          : 'bg-warning/10 border-warning/30'
      )}
      role='status'
    >
      {isPending ? (
        <Clock className='text-info mt-0.5 size-4 shrink-0' />
      ) : (
        <AlertTriangle className='text-warning mt-0.5 size-4 shrink-0' />
      )}
      <div className='flex flex-col gap-0.5'>
        <span className='text-sm font-medium'>
          {t(isPending ? 'Account under review' : 'Account restricted')}
        </span>
        <span className='text-muted-foreground text-xs'>
          {t(
            isPending
              ? 'Your account is waiting for administrator review. Please join our WeChat group and tell the admin your username to get approved.'
              : 'Abnormal activity detected on this account. For now only the free NVIDIA models are available. Please join our WeChat group to contact the admin.'
          )}
        </span>
      </div>
    </div>
  )
}
