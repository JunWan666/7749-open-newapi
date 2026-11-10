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
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ChevronRight, Clock } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

const STATUS_PENDING = 3
const STATUS_SUSPICIOUS = 4

type NoticeBlock = {
  title: string
  description: string
  steps: string[]
  footer: string
  note: string
}

type NoticeContact = {
  name: string
  role: string
  avatar: string
}

type NoticeConfig = {
  pending: NoticeBlock
  restricted: NoticeBlock
  contacts: NoticeContact[]
}

async function fetchNoticeConfig(): Promise<NoticeConfig | null> {
  try {
    const res = await fetch('/api/notice-config')
    if (!res.ok) {
      return null
    }
    const data = (await res.json()) as { data?: NoticeConfig }
    return data.data ?? null
  } catch {
    return null
  }
}

/**
 * Prominent banner for accounts that are not fully enabled.
 * All copy comes from the server config, editable from the admin console.
 */
export function AccountStatusBanner() {
  const { t } = useTranslation()
  const status = useAuthStore((state) => state.auth.user?.status)
  const username = useAuthStore((state) => state.auth.user?.username)
  const [open, setOpen] = useState(false)
  const [zoom, setZoom] = useState(false)
  const [qrOk, setQrOk] = useState(true)

  const active = status === STATUS_PENDING || status === STATUS_SUSPICIOUS
  const { data: config, isLoading } = useQuery({
    queryKey: ['notice-config'],
    queryFn: fetchNoticeConfig,
    staleTime: 5 * 60_000,
    enabled: active,
  })

  if (!active) {
    return null
  }

  const isPending = status === STATUS_PENDING
  const block = isPending ? config?.pending : config?.restricted
  const contacts = config?.contacts ?? []

  const barClass = isPending
    ? 'border-amber-500 bg-amber-400 text-amber-950 dark:border-amber-600 dark:bg-amber-500'
    : 'border-rose-600 bg-rose-500 text-white dark:border-rose-700 dark:bg-rose-600'
  const btnClass = isPending
    ? 'border-amber-700/60 bg-amber-50/70 hover:bg-amber-100'
    : 'border-rose-900/40 bg-white/20 hover:bg-white/30'

  const title =
    block?.title || t(isPending ? 'Account under review' : 'Account restricted')
  const headline =
    block?.description ||
    t(
      isPending
        ? 'API access is locked until an admin approves your account.'
        : 'Only the free NVIDIA (ywd) models are available right now.'
    )

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
          <span className='font-semibold'>{title}</span>
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
        <DialogContent className='max-h-[88vh] overflow-y-auto sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>

          <div className='flex flex-col gap-4 text-sm'>
            {isLoading ? (
              <div className='space-y-2'>
                <Skeleton className='h-40 w-full rounded-lg' />
                <Skeleton className='h-10 w-full rounded-lg' />
              </div>
            ) : (
              <>
                {block?.description && (
                  <p className='text-muted-foreground text-xs leading-relaxed'>
                    {block.description}
                  </p>
                )}

                {qrOk && (
                  <div className='flex flex-col items-center gap-1.5'>
                    <button
                      type='button'
                      className='cursor-zoom-in rounded-lg border bg-white p-1.5'
                      onClick={() => setZoom(true)}
                      aria-label={t('Click to enlarge')}
                    >
                      <img
                        src='/api/group-qrcode'
                        alt={t('WeChat Group QR Code')}
                        className='h-44 w-44 object-contain'
                        onError={() => setQrOk(false)}
                      />
                    </button>
                    <span className='text-muted-foreground text-[11px]'>
                      {t('Scan to join our WeChat group')}
                    </span>
                  </div>
                )}

                <div className='bg-muted flex items-center justify-between gap-2 rounded-lg px-3 py-2'>
                  <div className='flex min-w-0 flex-col'>
                    <span className='text-muted-foreground text-[11px]'>
                      {t('Your username')}
                    </span>
                    <span className='truncate font-mono text-sm font-medium'>
                      {username || '-'}
                    </span>
                  </div>
                  {username && (
                    <CopyButton
                      value={username}
                      tooltip={t('Copy username')}
                      variant='outline'
                      className='h-7 gap-1 px-2 text-xs'
                    >
                      {t('Copy')}
                    </CopyButton>
                  )}
                </div>

                {contacts.length > 0 && (
                  <div className='flex flex-col gap-2'>
                    <span className='text-xs font-medium'>
                      {t('Contact these people in the group')}
                    </span>
                    <div className='grid grid-cols-2 gap-2'>
                      {contacts.map((contact) => (
                        <div
                          key={contact.name}
                          className='flex items-center gap-2 rounded-lg border px-2.5 py-2'
                        >
                          {contact.avatar ? (
                            <img
                              src={contact.avatar}
                              alt={contact.name}
                              className='size-9 shrink-0 rounded-full border object-cover'
                              onError={(event) => {
                                event.currentTarget.style.visibility = 'hidden'
                              }}
                            />
                          ) : (
                            <span className='bg-muted flex size-9 shrink-0 items-center justify-center rounded-full text-xs'>
                              {contact.name.slice(0, 1)}
                            </span>
                          )}
                          <div className='min-w-0'>
                            <div className='truncate text-xs font-semibold'>
                              {contact.name}
                            </div>
                            <div className='text-muted-foreground truncate text-[11px]'>
                              {contact.role}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {block && block.steps.length > 0 && (
                  <div className='flex flex-col gap-1.5'>
                    <span className='text-xs font-medium'>
                      {t('How to get approved')}
                    </span>
                    <ol className='text-muted-foreground flex list-decimal flex-col gap-1.5 pl-5 text-xs leading-relaxed'>
                      {block.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {block?.footer && (
                  <p className='text-xs font-medium'>{block.footer}</p>
                )}
                {block?.note && (
                  <p className='text-muted-foreground text-xs'>{block.note}</p>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button type='button' onClick={() => setOpen(false)}>
              {t('Got it')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {zoom &&
        createPortal(
          <div
            role='dialog'
            aria-modal='true'
            aria-label={t('WeChat Group QR Code')}
            className='fixed inset-0 z-[100] flex cursor-zoom-out flex-col items-center justify-center gap-3 bg-black/85 p-4'
            onClick={() => setZoom(false)}
          >
            <img
              src='/api/group-qrcode'
              alt={t('WeChat Group QR Code')}
              className='max-h-[82vh] max-w-full rounded-xl bg-white object-contain p-3 shadow-2xl'
            />
            <span className='text-xs text-white/70'>
              {t('Click anywhere to close')}
            </span>
          </div>,
          document.body
        )}
    </>
  )
}
