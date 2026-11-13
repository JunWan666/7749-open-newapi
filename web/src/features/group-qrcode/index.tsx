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
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ImagePlus,
  Loader2,
  Sparkles,
  Trash2,
  ZoomIn,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import dayjs from '@/lib/dayjs'
import { cn } from '@/lib/utils'

import {
  deleteGroupQrcode,
  detectGroupQrcodeExpiry,
  getGroupQrcodeMeta,
  updateGroupQrcodeMeta,
  uploadGroupQrcode,
} from './api'

type GroupQrcodeMeta = {
  exists: boolean
  expires_at: string
  updated_at: number
}

/**
 * Admin page for the WeChat group QR code shown to pending-review users.
 * Supports click / drag-and-drop / Ctrl+V upload and click-to-enlarge preview.
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
  const [detecting, setDetecting] = useState(false)
  const [savingMeta, setSavingMeta] = useState(false)
  const [previewError, setPreviewError] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [zoom, setZoom] = useState(false)

  const expiresDate = meta.expires_at ? dayjs(meta.expires_at) : null
  const daysLeft = expiresDate
    ? expiresDate.endOf('day').diff(dayjs(), 'day')
    : null
  const expired = daysLeft !== null && daysLeft < 0
  const expiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 3
  // 后端已有日期时同步到输入框（用户手动改动不会被覆盖，除非 meta 变化）
  useEffect(() => {
    setExpiresAt(meta.expires_at || '')
  }, [meta.expires_at])

  const hasImage = meta.exists && !previewError
  const imageSrc = `/api/group-qrcode?t=${version}`

  // 用视觉模型读取图片底部印的有效期，识别成功自动保存
  const handleDetect = useCallback(
    async (silent: boolean) => {
      setDetecting(true)
      try {
        const res = await detectGroupQrcodeExpiry()
        if (res?.success && res.data?.expires_at) {
          setExpiresAt(res.data.expires_at)
          await updateGroupQrcodeMeta(res.data.expires_at)
          await refetch()
          toast.success(
            t('Detected expiry date: {{date}}', { date: res.data.expires_at })
          )
          return
        }
        if (silent) {
          toast.warning(
            t('No expiry date detected on the image, please fill it in manually')
          )
        } else {
          toast.error(
            res?.message ||
              t('Could not detect the expiry date, please fill it in manually')
          )
        }
      } catch {
        if (!silent) {
          toast.error(t('Could not detect the expiry date, please fill it in manually'))
        }
      } finally {
        setDetecting(false)
      }
    },
    [refetch, t]
  )

  async function handleSaveMeta() {
    setSavingMeta(true)
    try {
      const res = await updateGroupQrcodeMeta(expiresAt)
      if (res?.success) {
        toast.success(t('Saved'))
        await refetch()
      } else {
        toast.error(res?.message || t('Save failed'))
      }
    } catch {
      toast.error(t('Save failed'))
    } finally {
      setSavingMeta(false)
    }
  }

  const handleFile = useCallback(
    async (file: File) => {
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
          if (!expiresAt) {
            void handleDetect(true)
          }
        } else {
          toast.error(res?.message || t('Upload failed'))
        }
      } catch {
        toast.error(t('Upload failed'))
      } finally {
        setBusy(false)
      }
    },
    [expiresAt, handleDetect, refetch, t]
  )

  // Allow pasting a screenshot directly from the clipboard (Ctrl+V).
  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      const items = [...(event.clipboardData?.items ?? [])]
      const imageItem = items.find((item) => item.type.startsWith('image/'))
      if (!imageItem) {
        return
      }
      const file = imageItem.getAsFile()
      if (file) {
        event.preventDefault()
        void handleFile(file)
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [handleFile])

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
        <StatusBadge
          label={t('Not uploaded')}
          variant='neutral'
          copyable={false}
        />
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

  function renderExpiryNotice() {
    if (daysLeft === null) {
      return null
    }
    if (expired) {
      return (
        <div className='border-destructive/30 bg-destructive/10 text-destructive flex w-full items-start gap-2 rounded-md border px-3 py-2 text-xs'>
          <AlertTriangle className='mt-0.5 size-3.5 shrink-0' />
          <span>
            {t(
              'This QR code has expired. Upload a new WeChat group QR code right away, otherwise users cannot join.'
            )}
          </span>
        </div>
      )
    }
    if (expiringSoon) {
      return (
        <div className='border-warning/30 bg-warning/10 flex w-full items-start gap-2 rounded-md border px-3 py-2 text-xs'>
          <AlertTriangle className='mt-0.5 size-3.5 shrink-0' />
          <span>
            {t(
              'This QR code expires in a few days. Remember to upload a fresh one before it stops working.'
            )}
          </span>
        </div>
      )
    }
    return (
      <div className='border-success/30 bg-success/10 flex w-full items-start gap-2 rounded-md border px-3 py-2 text-xs'>
        <CheckCircle2 className='mt-0.5 size-3.5 shrink-0' />
        <span>
          {t('QR code is valid until')} {meta.expires_at}
        </span>
      </div>
    )
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>
        {t('WeChat Group QR Code')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='mx-auto flex w-full max-w-4xl flex-col gap-5'>
          <p className='text-muted-foreground text-sm'>
            {t(
              'Pending-review users see this QR code in their notice so they can join the WeChat group. WeChat codes usually expire after 7 days — record the expiry date so you get a reminder here.'
            )}
          </p>

          <div className='grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]'>
            {/* 预览卡片 */}
            <div className='bg-card flex flex-col items-center gap-3 rounded-xl border p-4 shadow-sm sm:p-5'>
              <div className='flex w-full items-center justify-between gap-2'>
                <span className='text-sm font-semibold'>
                  {t('Current QR Code')}
                </span>
                {renderStatus()}
              </div>

              <button
                type='button'
                className={cn(
                  'relative mt-1 flex aspect-square w-full max-w-[240px] items-center justify-center overflow-hidden rounded-lg border bg-white p-2 transition-shadow',
                  hasImage
                    ? 'group hover:ring-primary/40 cursor-zoom-in hover:ring-2'
                    : 'cursor-default'
                )}
                onClick={() => {
                  if (hasImage) {
                    setZoom(true)
                  }
                }}
                aria-label={t('Click to enlarge')}
              >
                {hasImage ? (
                  <>
                    <img
                      src={imageSrc}
                      alt={t('WeChat Group QR Code')}
                      className='h-full w-full object-contain'
                      onError={() => setPreviewError(true)}
                    />
                    <span className='pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100'>
                      <ZoomIn className='size-6 text-white' />
                    </span>
                  </>
                ) : (
                  <span className='text-muted-foreground px-4 text-center text-xs'>
                    {t('No QR code uploaded yet')}
                  </span>
                )}
              </button>

              <p className='text-muted-foreground text-center text-[11px]'>
                {hasImage ? t('Click the image to enlarge') : '\u00a0'}
              </p>

              {renderExpiryNotice()}
            </div>

            {/* 操作卡片 */}
            <div className='bg-card flex flex-col gap-4 rounded-xl border p-4 shadow-sm sm:p-5'>
              <div className='flex flex-col gap-1.5'>
                <label
                  className='text-sm font-semibold'
                  htmlFor='group-qrcode-expiry'
                >
                  {t('Expiry date printed on the image')}
                </label>
                <div className='flex flex-wrap items-center gap-2'>
                  <Input
                    id='group-qrcode-expiry'
                    type='date'
                    value={expiresAt}
                    onChange={(event) => setExpiresAt(event.target.value)}
                    className='w-44'
                  />
                  <Button
                    size='sm'
                    variant='outline'
                    disabled={savingMeta || !expiresAt}
                    onClick={() => {
                      void handleSaveMeta()
                    }}
                  >
                    {savingMeta && (
                      <Loader2 className='mr-1 size-3.5 animate-spin' />
                    )}
                    {t('Save expiry')}
                  </Button>
                  <Button
                    size='sm'
                    variant='outline'
                    disabled={detecting || !meta.exists}
                    onClick={() => {
                      void handleDetect(false)
                    }}
                  >
                    {detecting ? (
                      <Loader2 className='mr-1 size-3.5 animate-spin' />
                    ) : (
                      <Sparkles className='mr-1 size-3.5' />
                    )}
                    {t('Detect from image')}
                  </Button>
                </div>
                {expiresAt === '' && (
                  <p className='text-destructive flex items-center gap-1 text-xs'>
                    <AlertTriangle className='size-3.5 shrink-0' />
                    {t(
                      'No expiry date set — you will not get an expiry reminder'
                    )}
                  </p>
                )}
                <p className='text-muted-foreground text-xs'>
                  {t(
                    'Uploading is allowed without a date, but you will not be reminded before it expires. The date is printed on the QR image (e.g. “valid until Nov 20”).'
                  )}
                </p>
              </div>

              <input
                ref={inputRef}
                type='file'
                accept='image/png,image/jpeg,image/webp'
                className='hidden'
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  if (file) {
                    void handleFile(file)
                  }
                }}
              />

              <div
                role='button'
                tabIndex={0}
                aria-label={t('Upload area')}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    inputRef.current?.click()
                  }
                }}
                onDragOver={(event) => {
                  event.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(event) => {
                  event.preventDefault()
                  setDragOver(false)
                  const file = event.dataTransfer.files?.[0]
                  if (file) {
                    void handleFile(file)
                  }
                }}
                className={cn(
                  'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors',
                  dragOver
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/25 hover:border-primary/60 hover:bg-muted/40'
                )}
              >
                <ImagePlus
                  className={cn(
                    'size-8',
                    dragOver ? 'text-primary' : 'text-muted-foreground'
                  )}
                />
                <p className='text-sm font-medium'>
                  {busy
                    ? t('Uploading...')
                    : t('Drop an image here, or click to choose')}
                </p>
                <p className='text-muted-foreground text-xs'>
                  {t('You can also paste with Ctrl+V')} ·{' '}
                  {t('PNG / JPG / WebP, up to 2MB.')}
                </p>
              </div>

              <div className='flex flex-wrap items-center gap-2'>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  disabled={busy || !meta.exists}
                  onClick={() => {
                    void handleDelete()
                  }}
                >
                  <Trash2 className='mr-1.5 size-4' />
                  {t('Delete')}
                </Button>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  disabled={!hasImage}
                  onClick={() => window.open(imageSrc, '_blank')}
                >
                  <Download className='mr-1.5 size-4' />
                  {t('Download')}
                </Button>
                {meta.updated_at > 0 && (
                  <span className='text-muted-foreground ml-auto text-xs'>
                    {t('Updated')}:{' '}
                    {dayjs.unix(meta.updated_at).format('YYYY-MM-DD HH:mm')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </SectionPageLayout.Content>

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
              src={imageSrc}
              alt={t('WeChat Group QR Code')}
              className='max-h-[82vh] max-w-full rounded-xl bg-white object-contain p-3 shadow-2xl'
            />
            <span className='text-xs text-white/70'>
              {t('Click anywhere to close')}
            </span>
          </div>,
          document.body
        )}
    </SectionPageLayout>
  )
}
