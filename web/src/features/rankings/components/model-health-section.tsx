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
import { Activity, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/components/ui/skeleton'
import dayjs from '@/lib/dayjs'
import { cn } from '@/lib/utils'

type HealthModel = {
  model: string
  upstream: string
  level: string
  ms: number
  status: string
  detail: string
  avg_ms: number | null
  size_b: number | null
  calls_7d: number
}

type HealthChannel = {
  id: number
  name: string
  group: string
  models: HealthModel[]
}

type HealthResponse = {
  updated_at: number
  next_update_at: number
  running: boolean
  interval: number
  channels: HealthChannel[]
}

async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch('/rank-api/api/health')
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }
  return (await res.json()) as HealthResponse
}

const LEVEL_STYLES: Record<string, string> = {
  green: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  yellow: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  orange: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
  purple: 'bg-purple-500/15 text-purple-700 dark:text-purple-300',
  blue: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  red: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
}

function formatMs(ms: number | null | undefined): string {
  if (!ms || ms <= 0) {
    return '-'
  }
  if (ms >= 10000) {
    return `${(ms / 1000).toFixed(1)}s`
  }
  return `${Math.round(ms)}ms`
}

export function ModelHealthSection() {
  const { t } = useTranslation()
  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['rank-api', 'health'],
    queryFn: fetchHealth,
    staleTime: 60_000,
    refetchInterval: 120_000,
  })

  const channels = data?.channels ?? []
  const allModels = channels.flatMap((channel) => channel.models)
  const upCount = allModels.filter((model) => model.status === 'up').length

  function renderBody(): ReactNode {
    if (isLoading) {
      return (
        <div className='grid gap-4 lg:grid-cols-2'>
          <Skeleton className='h-64 w-full rounded-xl' />
          <Skeleton className='h-64 w-full rounded-xl' />
        </div>
      )
    }
    if (isError) {
      return (
        <div className='text-muted-foreground rounded-xl border border-dashed px-6 py-10 text-center text-sm'>
          {t('Unable to load health data')}
        </div>
      )
    }
    return (
      <>
        <div className='grid gap-3 sm:grid-cols-3'>
          <StatCard label={t('Channels')} value={String(channels.length)} />
          <StatCard
            label={t('Models monitored')}
            value={String(allModels.length)}
          />
          <StatCard
            label={t('Available now')}
            value={`${upCount}/${allModels.length}`}
          />
        </div>

        <div className='grid gap-4 lg:grid-cols-2'>
          {channels.map((channel) => (
            <div
              key={channel.id}
              className='bg-card overflow-hidden rounded-xl border shadow-sm'
            >
              <div className='bg-muted/40 flex flex-wrap items-center gap-2 border-b px-3 py-2'>
                <span className='text-sm font-semibold'>{channel.name}</span>
                <span className='text-muted-foreground font-mono text-[11px]'>
                  {channel.group}
                </span>
                <span className='text-muted-foreground ml-auto text-[11px]'>
                  {channel.models.length} {t('models')}
                </span>
              </div>
              <div className='divide-y'>
                {channel.models.map((model) => (
                  <div
                    key={model.model}
                    className='hover:bg-muted/30 flex items-center gap-2 px-3 py-2 transition-colors'
                  >
                    <span
                      className={cn(
                        'size-1.5 shrink-0 rounded-full',
                        model.status === 'up' ? 'bg-emerald-500' : 'bg-rose-500'
                      )}
                    />
                    <span
                      className='min-w-0 flex-1 truncate font-mono text-xs'
                      title={model.model}
                    >
                      {model.model}
                    </span>
                    <span
                      className={cn(
                        'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium',
                        LEVEL_STYLES[model.level] ?? LEVEL_STYLES.green
                      )}
                    >
                      {formatMs(model.ms)}
                    </span>
                    <span className='text-muted-foreground w-14 shrink-0 text-right text-[11px] tabular-nums'>
                      {model.calls_7d ? `${model.calls_7d}` : '-'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className='text-muted-foreground text-xs'>
          {t(
            'Latency is probed automatically; numbers show the latest round-trip time. Calls column counts the last 7 days.'
          )}
        </p>
      </>
    )
  }

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='flex items-center gap-2'>
          <Activity className='text-primary size-5' />
          <h2 className='text-lg font-semibold'>{t('Model Health')}</h2>
        </div>
        <div className='flex items-center gap-2'>
          <span className='text-muted-foreground text-xs'>
            {data?.updated_at
              ? `${t('Updated')}: ${dayjs.unix(data.updated_at).format('HH:mm:ss')}`
              : ''}
          </span>
          <button
            type='button'
            onClick={() => {
              void refetch()
            }}
            className='text-muted-foreground hover:text-foreground transition-colors'
            aria-label={t('Refresh')}
          >
            <RefreshCw className={cn('size-4', isFetching && 'animate-spin')} />
          </button>
        </div>
      </div>

      {renderBody()}
    </section>
  )
}

function StatCard(props: { label: string; value: string }) {
  return (
    <div className='bg-card rounded-xl border px-4 py-3 shadow-sm'>
      <div className='text-muted-foreground text-[11px]'>{props.label}</div>
      <div className='mt-0.5 text-lg font-semibold tabular-nums'>
        {props.value}
      </div>
    </div>
  )
}
