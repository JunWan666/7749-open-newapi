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
import { AlertTriangle, ChevronRight, Clock } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

const STATUS_PENDING = 3
const STATUS_SUSPICIOUS = 4

/**
 * Prominent banner for accounts that are not fully enabled.
 * - pending review: cannot call APIs until an admin approves
 * - suspicious: only the free NVIDIA (ywd/*) models are available
 * The "Details" button opens a dialog with the full explanation and next steps.
 */
export function AccountStatusBanner() {
  const { t } = useTranslation()
  const status = useAuthStore((state) => state.auth.user?.status)
  const username = useAuthStore((state) => state.auth.user?.username)
  const [open, setOpen] = useState(false)
  const [qrOk, setQrOk] = useState(true)

  if (status !== STATUS_PENDING && status !== STATUS_SUSPICIOUS) {
    return null
  }

  const isPending = status === STATUS_PENDING

  return (
    <>
      <div
        className={cn(
          'flex h-11 items-center gap-3 border-b-2 px-4',
          isPending
            ? 'border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-100'
            : 'border-rose-400 bg-rose-50 text-rose-900 dark:border-rose-700 dark:bg-rose-950/60 dark:text-rose-100'
        )}
        role='status'
      >
        {isPending ? (
          <Clock className='size-5 shrink-0' />
        ) : (
          <AlertTriangle className='size-5 shrink-0' />
        )}
        <div className='min-w-0 flex-1 text-sm'>
          <span className='font-semibold'>
            {t(isPending ? 'Account under review' : 'Account restricted')}
          </span>
          <span className='mx-2 opacity-60'>|</span>
          <span className='opacity-90'>
            {t(
              isPending
                ? 'API access is locked until an admin approves your account.'
                : 'Only the free NVIDIA (ywd) models are available right now.'
            )}
          </span>
        </div>
        <button
          type='button'
          onClick={() => setOpen(true)}
          className={cn(
            'flex shrink-0 cursor-pointer items-center gap-0.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors',
            isPending
              ? 'border-amber-400/70 hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900/50'
              : 'border-rose-400/70 hover:bg-rose-100 dark:border-rose-700 dark:hover:bg-rose-900/50'
          )}
        >
          {t('Details')}
          <ChevronRight className='size-3.5' />
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>
              {t(isPending ? 'Account under review' : 'Account restricted')}
            </DialogTitle>
            <DialogDescription>
              {t(
                isPending
                  ? 'Your account was created successfully, but it needs administrator approval before you can call models.'
                  : 'Abnormal usage was detected on this account, so it is temporarily limited to free models.'
              )}
            </DialogDescription>
          </DialogHeader>

          <div className='flex flex-col gap-3 text-sm'>
            <div className='bg-muted flex items-center justify-between rounded-md px-3 py-2'>
              <span className='text-muted-foreground text-xs'>
                {t('Your username')}
              </span>
              <span className='font-mono text-sm font-medium'>
                {username || '-'}
              </span>
            </div>

            {qrOk && (
              <div className='flex flex-col items-center gap-1'>
                <img
                  src='/api/group-qrcode'
                  alt={t('WeChat Group QR Code')}
                  className='h-44 w-44 rounded-md border object-contain'
                  onError={() => setQrOk(false)}
                />
                <span className='text-muted-foreground text-xs'>
                  {t('Scan to join our WeChat group')}
                </span>
              </div>
            )}

            <div className='flex flex-col gap-1.5'>
              <span className='font-medium'>{t('How to get approved')}</span>
              <ol className='text-muted-foreground flex list-decimal flex-col gap-1 pl-5 text-xs'>
                <li>
                  {t('Join our WeChat group (ask the admin for the QR code).')}
                </li>
                <li>
                  {t(
                    'Send your username to the admin so they can match your account.'
                  )}
                </li>
                <li>
                  {t(
                    'Once approved, your account switches to normal and all models become available.'
                  )}
                </li>
              </ol>
            </div>

            {!isPending && (
              <p className='text-muted-foreground text-xs'>
                {t(
                  'If you believe this is a mistake, tell the admin what you are using the API for and they will review it.'
                )}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type='button' onClick={() => setOpen(false)}>
              {t('Got it')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
