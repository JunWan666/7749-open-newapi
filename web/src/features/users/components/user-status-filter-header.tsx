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
import type { Column } from '@tanstack/react-table'
import { Check, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import { getUserStatusOptions } from '../constants'
import type { User } from '../types'

interface UserStatusFilterHeaderProps {
  column: Column<User, unknown>
}

/**
 * Status column header with an inline multi-select filter, so admins can filter
 * the user list by status without opening the toolbar filter.
 */
export function UserStatusFilterHeader(props: UserStatusFilterHeaderProps) {
  const { t } = useTranslation()
  const options = getUserStatusOptions(t).filter(
    (option) => option.value !== '-1'
  )
  const current =
    (props.column.getFilterValue() as string[] | undefined) ?? []

  function toggle(value: string) {
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value]
    props.column.setFilterValue(next.length > 0 ? next : undefined)
  }

  return (
    <Popover>
      <PopoverTrigger
        render={<button type='button' className='flex cursor-pointer items-center gap-1' />}
      >
        <span>{t('Status')}</span>
        <ChevronDown className='size-3 opacity-60' />
        {current.length > 0 && (
          <span className='bg-primary text-primary-foreground rounded-full px-1.5 text-[10px] leading-4'>
            {current.length}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent className='w-44 p-1'>
        <div className='text-muted-foreground px-2 py-1 text-[11px]'>
          {t('Filter by status')}
        </div>
        {options.map((option) => {
          const active = current.includes(option.value)
          return (
            <button
              key={option.value}
              type='button'
              onClick={() => toggle(option.value)}
              className={cn(
                'hover:bg-muted flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs',
                active && 'bg-muted/60'
              )}
            >
              <Check
                className={cn(
                  'size-3.5 shrink-0',
                  active ? 'opacity-100' : 'opacity-0'
                )}
              />
              <span>{option.label}</span>
            </button>
          )
        })}
        {current.length > 0 && (
          <button
            type='button'
            onClick={() => props.column.setFilterValue(undefined)}
            className='text-muted-foreground hover:text-foreground mt-1 w-full border-t px-2 py-1.5 text-left text-[11px]'
          >
            {t('Clear filter')}
          </button>
        )}
      </PopoverContent>
    </Popover>
  )
}
