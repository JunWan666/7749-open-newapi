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
import { createFileRoute } from '@tanstack/react-router'
import { ExternalLink, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import z from 'zod'

import { Button } from '@/components/ui/button'

const embedSearchSchema = z.object({
  url: z.string().catch(''),
  title: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/embed/')({
  validateSearch: embedSearchSchema,
  component: EmbedPage,
})

/** 站内内嵌页面：把管理员配置的外部地址用 iframe 铺在控制台里显示。 */
function EmbedPage() {
  const { t } = useTranslation()
  const { url, title } = Route.useSearch()
  const [reloadKey, setReloadKey] = useState(0)

  const safeUrl = /^https?:\/\//.test(url ?? '') ? String(url) : ''

  if (!safeUrl) {
    return (
      <div className='text-muted-foreground flex h-full items-center justify-center p-6 text-sm'>
        {t('No address configured for this menu')}
      </div>
    )
  }

  return (
    <div className='flex h-full flex-col'>
      <div className='flex items-center justify-between gap-3 border-b px-3 py-1.5'>
        <span className='min-w-0 truncate text-sm font-medium'>
          {title || safeUrl}
        </span>
        <div className='flex shrink-0 items-center gap-1'>
          <Button
            size='icon'
            variant='ghost'
            className='size-7'
            aria-label={t('Refresh')}
            onClick={() => setReloadKey((key) => key + 1)}
          >
            <RefreshCw className='size-3.5' />
          </Button>
          <Button
            size='icon'
            variant='ghost'
            className='size-7'
            aria-label={t('Open in new tab')}
            render={<a href={safeUrl} target='_blank' rel='noreferrer' />}
          >
            <ExternalLink className='size-3.5' />
          </Button>
        </div>
      </div>
      <iframe
        key={`${safeUrl}-${reloadKey}`}
        src={safeUrl}
        title={title || safeUrl}
        className='min-h-0 w-full flex-1 border-0'
        allow='camera; microphone; fullscreen'
      />
    </div>
  )
}
