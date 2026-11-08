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
import { AlertTriangle, CheckCircle2, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import dayjs from '@/lib/dayjs'

import {
  deleteGroupQrcode,
  getGroupQrcodeMeta,
  uploadGroupQrcode,
} from './api'

type GroupQrcodeMeta = {
  exists: boolean
  expires_at: string
  updated_at: number
}

/**
 * Admin page for the WeChat group QR code shown to pending-review users.
 * The image lives on the server data volume, so replacing it never needs a rebuild.
 */
export function GroupQrcode() {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const { data, refetch } = useQuery({
    queryKey: ['group-qrcode-meta'],
    queryFn: getGroupQrcodeMeta,
  })
  const meta: GroupQrcodeMeta = data?.data ?? {
    exists: false,
    expires_at: '',
    updated_at: 0,
  }
  const [expiresAt, setExpiresAt] = useState('')
  const [version, setVersion] = useState(() => Date.now())
  const [busy, setBusy] = useState(false)
  const [previewError, setPreviewError] = useState(false)

  const expiresDate = meta.expires_at ? dayjs(meta.expires_at) : null
  const daysLeft = expiresDate
    ? expiresDate.endOf('day').diff(dayjs(), 'day')
    : null
  const expired = daysLeft !== null && daysLeft < 0
  const expiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 3

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error(t('Image must be under 2MB'))
      return
    }
    setBusy(true)
    try {
      const res = await uploadGroupQrcode(file, expiresAt)
      if (res?.success) {
        toast.success(t('Uploaded'))
        setVersion(Date.now())
        setPreviewError(false)
        await refetch()
      } else {
        toast.error(res?.message || t('Upload failed'))
      }
    } catch {
      toast.error(t('Upload failed'))
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    setBusy(true)
    try {
      const res = await deleteGroupQrcode()
      if (res?.success) {
        toast.success(t('Deleted'))
        setExpiresAt('')
        setVersion(Date.now())
        await refetch()
      } else {
        toast.error(res?.message || t('Delete failed'))
      }
    } catch {
      toast.error(t('Delete failed'))
    } finally {
      setBusy(false)
    }
  }

  function renderStatus() {
    if (!meta.exists) {
      return (
        <StatusBadge label={t('Not uploaded')} variant='neutral' copyable={false} />
      )
    }
    if (!expiresDate) {
      return (
        <StatusBadge label={t('No expiry set')} variant='info' copyable={false} />
      )
    }
    if (expired) {
      return (
        <StatusBadge
          label={`${t('Expired')} · ${meta.expires_at}`}
          variant='danger'
          copyable={false}
        />
      )
    }
    if (expiringSoon) {
      return (
        <StatusBadge
          label={`${t('Expires soon')} · ${daysLeft} ${t('days left')}`}
          variant='warning'
          copyable={false}
        />
      )
    }
    return (
      <StatusBadge
        label={`${t('Valid')} · ${daysLeft} ${t('days left')}`}
        variant='success'
        copyable={false}
      />
    )
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('WeChat Group QR Code')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='flex max-w-3xl flex-col gap-5'>
          <p className='text-muted-foreground text-sm'>
            {t(
              'Pending-review users see this QR code in their notice so they can join the WeChat group. WeChat codes usually expire after 7 days — record the expiry date so you get a reminder here.'
            )}
          </p>

          <div className='flex flex-wrap items-start gap-6'>
            <div className='flex flex-col items-center gap-2'>
              <div className='bg-muted flex h-44 w-44 items-center justify-center overflow-hidden rounded-lg border'>
                {meta.exists && !previewError ? (
                  <img
                    src={`/api/group-qrcode?t=${version}`}
                    alt={t('WeChat Group QR Code')}
                    className='h-full w-full object-contain'
                    onError={() => setPreviewError(true)}
                  />
                ) : (
                  <span className='text-muted-foreground px-3 text-center text-xs'>
                    {t('No QR code uploaded yet')}
                  </span>
                )}
              </div>
              {renderStatus()}
            </div>

            <div className='flex min-w-[260px] flex-1 flex-col gap-3'>
              <div className='flex flex-col gap-1.5'>
                <label
                  className='text-sm font-medium'
                  htmlFor='group-qrcode-expiry'
                >
                  {t('Expiry date on the image (optional)')}
                </label>
                <Input
                  id='group-qrcode-expiry'
                  type='date'
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                  className='w-48'
                />
                <p className='text-muted-foreground text-xs'>
                  {t('Paste the date printed on the WeChat QR code, e.g. "valid until Nov 16".')}
                </p>
              </div>

              <input
                ref={inputRef}
                type='file'
                accept='image/png,image/jpeg,image/webp'
                className='hidden'
                onChange={(event) => {
                  void handleFileChange(event)
                }}
              />

              <div className='flex flex-wrap gap-2'>
                <Button
                  type='button'
                  disabled={busy}
                  onClick={() => inputRef.current?.click()}
                >
                  <Upload className='mr-1.5 size-4' />
                  {t('Upload')}
                </Button>
                <Button
                  type='button'
                  variant='outline'
                  disabled={busy || !meta.exists}
                  onClick={() => {
                    void handleDelete()
                  }}
                >
                  <Trash2 className='mr-1.5 size-4' />
                  {t('Delete')}
                </Button>
              </div>

              <p className='text-muted-foreground text-xs'>
                {t('PNG / JPG / WebP, up to 2MB.')}
              </p>

              {expired && (
                <div className='border-destructive/30 bg-destructive/10 text-destructive flex items-start gap-2 rounded-md border px-3 py-2 text-xs'>
                  <AlertTriangle className='mt-0.5 size-3.5 shrink-0' />
                  <span>
                    {t(
                      'This QR code has expired. Upload a new WeChat group QR code right away, otherwise users cannot join.'
                    )}
                  </span>
                </div>
              )}

              {!expired && expiringSoon && (
                <div className='border-warning/30 bg-warning/10 flex items-start gap-2 rounded-md border px-3 py-2 text-xs'>
                  <AlertTriangle className='mt-0.5 size-3.5 shrink-0' />
                  <span>
                    {t(
                      'This QR code expires in a few days. Remember to upload a fresh one before it stops working.'
                    )}
                  </span>
                </div>
              )}

              {!expired && !expiringSoon && meta.exists && daysLeft !== null && (
                <div className='border-success/30 bg-success/10 flex items-start gap-2 rounded-md border px-3 py-2 text-xs'>
                  <CheckCircle2 className='mt-0.5 size-3.5 shrink-0' />
                  <span>
                    {t('QR code is valid until')} {meta.expires_at}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
