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
import { useState, type ReactNode } from 'react'
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
  history?: Record<string, string[]>
  history_ms?: Record<string, Array<number | null>>
}

type HealthResponse = {
  updated_at: number
  next_update_at: number
  running: boolean
  interval: number
  channels: HealthChannel[]
  history_buckets?: number
  history_span_minutes?: number
}

async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch('/rank-api/api/health')
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }
  return (await res.json()) as HealthResponse
}

const LEVEL_BG: Record<string, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-400',
  orange: 'bg-orange-500',
  purple: 'bg-purple-500',
  blue: 'bg-sky-500',
  red: 'bg-rose-500',
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

/** 最近 N 轮检测的历史色条（每格一轮，颜色代表延迟档位） */
function HistoryBar(props: {
  levels?: string[]
  ms?: Array<number | null>
  label: (level: string, ms: number | null) => string
}) {
  const { t } = useTranslation()
  const levels = props.levels ?? []
  if (levels.length === 0) {
    return (
      <span className='text-muted-foreground/50 text-[10px]'>{t('No history')}</span>
    )
  }
  const start = Math.max(0, levels.length - 60)
  return (
    <div className='flex items-center gap-[2px]'>
      {levels.slice(start).map((level, offset) => {
        const ms = props.ms?.[start + offset] ?? null
        return (
          <span
            key={`${level}-${start + offset}`}
            title={props.label(level, ms)}
            className={cn(
              'h-4 w-[3px] rounded-[1px] transition-opacity hover:opacity-70',
              LEVEL_BG[level] ?? LEVEL_BG.green
            )}
          />
        )
      })}
    </div>
  )
}

export function ModelHealthSection() {
  const { t } = useTranslation()
  const [activeChannelId, setActiveChannelId] = useState<number | null>(null)

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['rank-api', 'health'],
    queryFn: fetchHealth,
    staleTime: 60_000,
    refetchInterval: 120_000,
  })

  const channels = data?.channels ?? []
  const allModels = channels.flatMap((channel) => channel.models)
  const upCount = allModels.filter((model) => model.status === 'up').length
  const activeChannel =
    channels.find((channel) => channel.id === activeChannelId) ?? channels[0] ?? null

  function levelLabel(level: string, ms: number | null): string {
    return `${level}${ms ? ` · ${formatMs(ms)}` : ''}`
  }

  function renderModels(channel: HealthChannel): ReactNode {
    const history = channel.history ?? {}
    const historyMs = channel.history_ms ?? {}
    return (
      <div className='bg-card overflow-hidden rounded-xl border shadow-sm'>
        <div className='overflow-x-auto'>
          <table className='w-full min-w-[720px] text-xs'>
            <thead>
              <tr className='bg-muted/40 text-muted-foreground border-b text-[11px]'>
                <th className='px-3 py-2 text-left font-medium'>{t('Model')}</th>
                <th className='px-3 py-2 text-left font-medium'>
                  {t('Recent checks')}
                </th>
                <th className='px-3 py-2 text-right font-medium'>
                  {t('Latency')}
                </th>
                <th className='px-3 py-2 text-right font-medium'>{t('Avg')}</th>
                <th className='px-3 py-2 text-right font-medium'>
                  {t('Calls (7d)')}
                </th>
              </tr>
            </thead>
            <tbody className='divide-y'>
              {channel.models.map((model) => (
                <tr key={model.model} className='hover:bg-muted/30'>
                  <td className='max-w-[280px] px-3 py-2'>
                    <div className='flex items-center gap-2'>
                      <span
                        className={cn(
                          'size-1.5 shrink-0 rounded-full',
                          model.status === 'up' ? 'bg-emerald-500' : 'bg-rose-500'
                        )}
                      />
                      <div className='flex min-w-0 flex-col'>
                        <span className='truncate font-mono' title={model.model}>
                          {model.model}
                        </span>
                        {model.detail && model.detail !== 'ok' && (
                          <span
                            className='text-destructive/80 truncate text-[10px]'
                            title={model.detail}
                          >
                            {model.detail}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className='px-3 py-2'>
                    <HistoryBar
                      levels={history[model.model]}
                      ms={historyMs[model.model]}
                      label={levelLabel}
                    />
                  </td>
                  <td className='px-3 py-2 text-right'>
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums',
                        LEVEL_STYLES[model.level] ?? LEVEL_STYLES.green
                      )}
                    >
                      {formatMs(model.ms)}
                    </span>
                  </td>
                  <td className='text-muted-foreground px-3 py-2 text-right tabular-nums'>
                    {formatMs(model.avg_ms)}
                  </td>
                  <td className='text-muted-foreground px-3 py-2 text-right tabular-nums'>
                    {model.calls_7d ? model.calls_7d.toLocaleString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  function renderBody(): ReactNode {
    if (isLoading) {
      return (
        <div className='space-y-3'>
          <Skeleton className='h-20 w-full rounded-xl' />
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

        {/* 渠道切换 */}
        <div className='flex flex-wrap items-center gap-2'>
          {channels.map((channel) => {
            const active = activeChannel?.id === channel.id
            const down = channel.models.filter((m) => m.status !== 'up').length
            return (
              <button
                key={channel.id}
                type='button'
                onClick={() => setActiveChannelId(channel.id)}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                  active
                    ? 'border-primary/40 bg-primary/10 text-foreground'
                    : 'text-muted-foreground hover:border-primary/30 hover:text-foreground'
                )}
              >
                <span>{channel.name}</span>
                <span className='text-[10px] opacity-70'>
                  {channel.models.length}
                </span>
                {down > 0 && (
                  <span className='rounded bg-rose-500/15 px-1 text-[10px] text-rose-600 dark:text-rose-400'>
                    {down} {t('down')}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {activeChannel && renderModels(activeChannel)}

        <div className='text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]'>
          <span>
            {t(
              'Each square is one automatic check (~20 min). Green is fast, red is failing.'
            )}
          </span>
          {data?.history_span_minutes ? (
            <span>
              {t('History span')}: {Math.round(data.history_span_minutes / 60)}h
            </span>
          ) : null}
        </div>
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
