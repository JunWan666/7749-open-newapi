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
import { useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { StatusBadge } from '@/components/status-badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import { updateUserStatus } from '../api'
import {
  EDITABLE_USER_STATUSES,
  USER_STATUS,
  USER_STATUSES,
  isUserDeleted,
} from '../constants'
import type { User } from '../types'

const STATUS_HINTS: Record<number, string> = {
  [USER_STATUS.ENABLED]: 'Full access',
  [USER_STATUS.PENDING]: 'Cannot call API until approved',
  [USER_STATUS.SUSPICIOUS]: 'Only NVIDIA (ywd) models',
  [USER_STATUS.DISABLED]: 'Cannot sign in',
}

interface UserStatusCellProps {
  user: User
}

/**
 * Inline status switch for the admin user table.
 * enabled / pending review / suspicious / disabled.
 */
export function UserStatusCell(props: UserStatusCellProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  if (isUserDeleted(props.user)) {
    return <StatusBadge label={t('Deleted')} variant='danger' copyable={false} />
  }

  const current = USER_STATUSES[props.user.status as keyof typeof USER_STATUSES]

  async function changeStatus(status: number) {
    if (saving) {
      return
    }
    if (status === props.user.status) {
      setOpen(false)
      return
    }
    setSaving(true)
    try {
      const res = await updateUserStatus(props.user.id, status)
      if (res?.success) {
        toast.success(t('Status updated'))
        void queryClient.invalidateQueries({ queryKey: ['users'] })
        setOpen(false)
      } else {
        toast.error(res?.message || t('Save failed'))
      }
    } catch {
      toast.error(t('Save failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<button type='button' className='cursor-pointer' />}
      >
        <StatusBadge
          label={t(current?.labelKey || 'Enabled')}
          variant={current?.variant || 'success'}
          copyable={false}
        />
      </PopoverTrigger>
      <PopoverContent className='w-64 p-1'>
        {EDITABLE_USER_STATUSES.map((status) => {
          const cfg = USER_STATUSES[status]
          const active = props.user.status === status
          return (
            <button
              key={status}
              type='button'
              disabled={saving}
              onClick={() => {
                void changeStatus(status)
              }}
              className={cn(
                'hover:bg-muted flex w-full items-start gap-2 rounded px-2 py-1.5 text-left',
                active && 'bg-muted/60'
              )}
            >
              <Check
                className={cn(
                  'mt-0.5 size-3.5 shrink-0',
                  active ? 'opacity-100' : 'opacity-0'
                )}
              />
              <span className='flex flex-col gap-0.5'>
                <span className='text-xs font-medium'>{t(cfg.labelKey)}</span>
                <span className='text-muted-foreground text-[11px]'>
                  {t(STATUS_HINTS[status])}
                </span>
              </span>
            </button>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}
