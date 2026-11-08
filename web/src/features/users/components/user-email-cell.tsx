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
import { Eye, EyeOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { LongText } from '@/components/long-text'
import { maskEmail } from '@/lib/format'

import { useEmailMask } from './email-mask-store'

interface UserEmailCellProps {
  userId: number
  email?: string
}

export function UserEmailCell(props: UserEmailCellProps) {
  const { t } = useTranslation()
  const emailMask = useEmailMask()

  if (!props.email) {
    return <span className='text-muted-foreground/50 text-xs'>-</span>
  }

  const hidden = emailMask.isRowMasked(props.userId)

  return (
    <div className='group flex items-center gap-1'>
      <LongText className='text-muted-foreground max-w-[150px] text-xs'>
        {hidden ? maskEmail(props.email) : props.email}
      </LongText>
      <button
        type='button'
        title={hidden ? t('Show') : t('Hide')}
        aria-label={hidden ? t('Show') : t('Hide')}
        className='text-muted-foreground/50 hover:text-foreground shrink-0 cursor-pointer transition-colors'
        onClick={() => emailMask.toggleRow(props.userId)}
      >
        {hidden ? (
          <EyeOff className='h-3.5 w-3.5' />
        ) : (
          <Eye className='h-3.5 w-3.5' />
        )}
      </button>
    </div>
  )
}

/**
 * Header control: one click masks (or reveals) every email in the table.
 */
export function EmailMaskHeaderButton() {
  const { t } = useTranslation()
  const emailMask = useEmailMask()

  return (
    <div className='flex items-center gap-1'>
      <span>{t('Email')}</span>
      <button
        type='button'
        title={emailMask.masked ? t('Show') : t('Hide')}
        aria-label={emailMask.masked ? t('Show') : t('Hide')}
        className='text-muted-foreground/60 hover:text-foreground cursor-pointer transition-colors'
        onClick={emailMask.toggleAll}
      >
        {emailMask.masked ? (
          <EyeOff className='h-3.5 w-3.5' />
        ) : (
          <Eye className='h-3.5 w-3.5' />
        )}
      </button>
    </div>
  )
}
