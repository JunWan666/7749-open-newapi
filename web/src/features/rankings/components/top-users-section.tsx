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
import { CalendarRange, Crown, Users } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/components/ui/skeleton'
import dayjs from '@/lib/dayjs'
import { cn } from '@/lib/utils'

type TopUserRow = {
  user: string
  calls: number
  quota: number
  tokens: number
}

type TopUsersResponse = {
  days: number
  rows: TopUserRow[]
}

const DAY_OPTIONS = [1, 7, 30] as const

async function fetchTopUsers(days: number): Promise<TopUsersResponse> {
  const res = await fetch(`/rank-api/api/top_users?days=${days}`)
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }
  return (await res.json()) as TopUsersResponse
}

/** quota 换算：1 美元 = 500000 quota（按次计费 0.01 美元 = 5000 quota） */
function formatMoney(quota: number): string {
  const usd = quota / 500000
  if (usd >= 1000000) {
    return `$${(usd / 1000000).toFixed(2)}M`
  }
  if (usd >= 10000) {
    return `$${(usd / 1000).toFixed(1)}k`
  }
  if (usd >= 100) {
    return `$${Math.round(usd).toLocaleString()}`
  }
  return `$${usd.toFixed(2)}`
}

/** token 数量格式化：亿 / 万 */
function formatTokens(value: number): string {
  if (!value) {
    return '-'
  }
  if (value >= 100000000) {
    return `${(value / 100000000).toFixed(2)} 亿`
  }
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)} 万`
  }
  return value.toLocaleString()
}

const MEDAL_COLORS = [
  'bg-amber-400/20 text-amber-700 dark:text-amber-300 border-amber-400/40',
  'bg-slate-300/25 text-slate-600 dark:text-slate-300 border-slate-400/40',
  'bg-orange-400/20 text-orange-700 dark:text-orange-300 border-orange-400/40',
]
const MEDAL_COUNT = MEDAL_COLORS.length

export function TopUsersSection() {
  const { t } = useTranslation()
  // Default to 近 1 天, matching the platform ranking tab.
  const [days, setDays] = useState<number>(1)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['rank-api', 'top-users', days],
    queryFn: () => fetchTopUsers(days),
    staleTime: 60_000,
  })

  // 口径提示：近 1 天 = 今天 0 点起；近 7/30 天 = 滚动窗口
  const rangeLabel = useMemo(() => {
    const now = dayjs()
    if (days <= 1) {
      return `${now.format('MM-DD')} 00:00 ~ ${now.format('MM-DD HH:mm')}`
    }
    return `${now.subtract(days, 'day').format('MM-DD HH:mm')} ~ ${now.format('MM-DD HH:mm')}`
  }, [days])

  const rows = data?.rows ?? []
  const maxCalls = rows.length > 0 ? Math.max(...rows.map((r) => r.calls)) : 1
  const totalCalls = rows.reduce((sum, r) => sum + r.calls, 0)
  const totalQuota = rows.reduce((sum, r) => sum + r.quota, 0)

  function rankBadge(index: number): ReactNode {
    if (index < MEDAL_COUNT) {
      return (
        <span
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-full border',
            MEDAL_COLORS[index]
          )}
        >
          <Crown className='size-3.5' />
        </span>
      )
    }
    return (
      <span className='text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold'>
        {index + 1}
      </span>
    )
  }

  function renderBody(): ReactNode {
    if (isLoading) {
      return (
        <div className='space-y-2'>
          {['s1', 's2', 's3', 's4', 's5'].map((key) => (
            <Skeleton key={key} className='h-14 w-full rounded-lg' />
          ))}
        </div>
      )
    }
    if (isError) {
      return (
        <div className='text-muted-foreground rounded-xl border border-dashed px-6 py-10 text-center text-sm'>
          {t('Unable to load ranking data')}
        </div>
      )
    }
    if (rows.length === 0) {
      return (
        <div className='text-muted-foreground rounded-xl border border-dashed px-6 py-10 text-center text-sm'>
          {t('No data for this period')}
        </div>
      )
    }
    return (
      <>
        <div className='grid gap-3 sm:grid-cols-3'>
          <StatCard
            label={t('Listed users')}
            value={rows.length.toLocaleString()}
          />
          <StatCard
            label={t('Total calls')}
            value={totalCalls.toLocaleString()}
          />
          <StatCard label={t('Total spend')} value={formatMoney(totalQuota)} />
        </div>

        <div className='bg-card divide-y overflow-hidden rounded-xl border shadow-sm'>
          {rows.map((row, index) => (
            <div
              key={row.user}
              className='hover:bg-muted/40 flex items-center gap-3 px-3 py-3 transition-colors sm:px-4'
            >
              {rankBadge(index)}

              <div className='min-w-0 flex-1'>
                <div className='flex items-center justify-between gap-2'>
                  <span className='truncate font-mono text-sm font-medium'>
                    {row.user}
                  </span>
                  <span className='text-muted-foreground shrink-0 text-xs tabular-nums'>
                    {row.calls.toLocaleString()} {t('calls')}
                    <span className='mx-1 opacity-40'>·</span>
                    {formatTokens(row.tokens)} token
                  </span>
                </div>
                <div className='bg-muted mt-1.5 h-1.5 overflow-hidden rounded-full'>
                  <div
                    className='bg-primary/70 h-full rounded-full transition-[width] duration-500'
                    style={{
                      width: `${Math.max(3, (row.calls / maxCalls) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              <span className='text-muted-foreground w-20 shrink-0 text-right text-xs tabular-nums'>
                {formatMoney(row.quota)}
              </span>
            </div>
          ))}
        </div>
      </>
    )
  }

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='flex items-center gap-2'>
          <Users className='text-primary size-5' />
          <h2 className='text-lg font-semibold'>{t('Top Users')}</h2>
          <span className='text-muted-foreground text-xs'>
            {t('Names are partially masked')}
          </span>
        </div>
        <div className='flex flex-col items-end gap-1'>
        <div className='bg-muted/60 inline-flex rounded-lg p-0.5'>
          {DAY_OPTIONS.map((option) => (
            <button
              key={option}
              type='button'
              onClick={() => setDays(option)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                option === days
                  ? 'bg-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t('Last N days', { n: option })}
            </button>
          ))}
        </div>
        <span className='text-muted-foreground flex items-center gap-1 text-[11px]'>
          <CalendarRange className='size-3' />
          {rangeLabel}
        </span>
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
