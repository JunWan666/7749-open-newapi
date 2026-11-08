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
import { AlertTriangle, Check, ChevronRight, Clock, Copy } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

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
 * - pending review: cannot call APIs until an admin approves, must join the WeChat group
 * - suspicious: only the free NVIDIA (ywd/*) models are available
 * The "Details" button opens a dialog with the QR code and the exact steps.
 */
export function AccountStatusBanner() {
  const { t } = useTranslation()
  const status = useAuthStore((state) => state.auth.user?.status)
  const username = useAuthStore((state) => state.auth.user?.username)
  const [open, setOpen] = useState(false)
  const [qrOk, setQrOk] = useState(true)
  const [copied, setCopied] = useState(false)

  if (status !== STATUS_PENDING && status !== STATUS_SUSPICIOUS) {
    return null
  }

  const isPending = status === STATUS_PENDING

  const barClass = isPending
    ? 'border-amber-500 bg-amber-400 text-amber-950 dark:border-amber-600 dark:bg-amber-500'
    : 'border-rose-600 bg-rose-500 text-white dark:border-rose-700 dark:bg-rose-600'

  const btnClass = isPending
    ? 'border-amber-700/60 bg-amber-50/70 hover:bg-amber-100'
    : 'border-rose-900/40 bg-white/20 hover:bg-white/30'

  const headline = isPending
    ? t(
        'API access is locked until an admin approves your account. Please join our WeChat group.'
      )
    : t('Only the free NVIDIA (ywd) models are available right now.')

  async function copyUsername() {
    if (!username) {
      return
    }
    try {
      await navigator.clipboard.writeText(username)
      setCopied(true)
      toast.success(t('Copied'))
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t('Copy failed'))
    }
  }

  return (
    <>
      <div
        className={cn(
          'flex shrink-0 items-center gap-3 border-b px-4 py-2',
          barClass
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
          <span className='mx-2 opacity-50'>·</span>
          <span className='font-medium'>{headline}</span>
        </div>
        <button
          type='button'
          onClick={() => setOpen(true)}
          className={cn(
            'flex shrink-0 cursor-pointer items-center gap-0.5 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors',
            btnClass
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
                  ? 'Your account was created successfully. An administrator needs to approve it before you can call models.'
                  : 'Abnormal usage was detected on this account, so it is temporarily limited to free models.'
              )}
            </DialogDescription>
          </DialogHeader>

          <div className='flex flex-col gap-3 text-sm'>
            {qrOk && (
              <div className='flex flex-col items-center gap-1.5'>
                <a
                  href='/api/group-qrcode'
                  target='_blank'
                  rel='noreferrer'
                  title={t('Click to enlarge')}
                  className='cursor-zoom-in'
                >
                  <img
                    src='/api/group-qrcode'
                    alt={t('WeChat Group QR Code')}
                    className='h-52 w-52 rounded-lg border object-contain'
                    onError={() => setQrOk(false)}
                  />
                </a>
                <span className='text-muted-foreground text-xs'>
                  {t('Scan the QR code to join our WeChat group')}
                </span>
              </div>
            )}

            <div className='bg-muted flex items-center justify-between gap-2 rounded-md px-3 py-2'>
              <div className='flex min-w-0 flex-col'>
                <span className='text-muted-foreground text-[11px]'>
                  {t('Your username')}
                </span>
                <span className='truncate font-mono text-sm font-medium'>
                  {username || '-'}
                </span>
              </div>
              <Button
                type='button'
                size='sm'
                variant='outline'
                className='shrink-0'
                onClick={() => {
                  void copyUsername()
                }}
              >
                {copied ? (
                  <Check className='mr-1 size-3.5' />
                ) : (
                  <Copy className='mr-1 size-3.5' />
                )}
                {copied ? t('Copied') : t('Copy')}
              </Button>
            </div>

            <div className='flex flex-col gap-1.5'>
              <span className='font-medium'>{t('How to get approved')}</span>
              <ol className='text-muted-foreground flex list-decimal flex-col gap-1.5 pl-5 text-xs'>
                <li>{t('Scan the QR code above to join the WeChat group.')}</li>
                <li>
                  {t(
                    'Send the username above to the admin in the group so they can find your account.'
                  )}
                </li>
                <li>
                  {t(
                    'Rename your group nickname to "nickname-username" or "nickname-username-ID" so the admin can match it quickly.'
                  )}
                </li>
              </ol>
              <p className='mt-1 text-xs'>
                {t(
                  'Once approved, this banner disappears and all models become available.'
                )}
              </p>
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
