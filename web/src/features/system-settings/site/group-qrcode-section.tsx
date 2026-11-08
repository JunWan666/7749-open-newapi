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
import { Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

import { deleteGroupQrcode, uploadGroupQrcode } from '../api'

/**
 * Admin card for the WeChat group QR code.
 * The image is stored on the server data volume (/app/data/uploads) and served at
 * /api/group-qrcode, so it can be replaced any time without rebuilding the image.
 */
export function GroupQrcodeSection() {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [version, setVersion] = useState(() => Date.now())
  const [busy, setBusy] = useState(false)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/group-qrcode', { method: 'HEAD' })
      .then((res) => {
        if (!cancelled) {
          setMissing(!res.ok)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMissing(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [version])

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
      const res = await uploadGroupQrcode(file)
      if (res?.success) {
        toast.success(t('Uploaded'))
        setVersion(Date.now())
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
        setVersion(Date.now())
      } else {
        toast.error(res?.message || t('Delete failed'))
      }
    } catch {
      toast.error(t('Delete failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className='flex flex-col gap-4'>
      <p className='text-muted-foreground text-sm'>
        {t(
          'This QR code is shown to pending-review users in their notice, so they can join the WeChat group.'
        )}
      </p>

      <div className='flex flex-wrap items-start gap-4'>
        <div className='bg-muted flex h-40 w-40 items-center justify-center overflow-hidden rounded-lg border'>
          {missing ? (
            <span className='text-muted-foreground px-2 text-center text-xs'>
              {t('No QR code uploaded yet')}
            </span>
          ) : (
            <img
              src={`/api/group-qrcode?t=${version}`}
              alt={t('WeChat Group QR Code')}
              className='h-full w-full object-contain'
              onError={() => setMissing(true)}
            />
          )}
        </div>

        <div className='flex flex-col gap-2'>
          <input
            ref={inputRef}
            type='file'
            accept='image/png,image/jpeg,image/webp'
            className='hidden'
            onChange={(event) => {
              void handleFileChange(event)
            }}
          />
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
            disabled={busy || missing}
            onClick={() => {
              void handleDelete()
            }}
          >
            <Trash2 className='mr-1.5 size-4' />
            {t('Delete')}
          </Button>
          <p className='text-muted-foreground text-xs'>
            {t('PNG / JPG / WebP, up to 2MB.')}
          </p>
        </div>
      </div>
    </div>
  )
}
