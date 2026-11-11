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
import { CalendarRange, Crown, Trophy } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/components/ui/skeleton'
import dayjs from '@/lib/dayjs'
import { cn } from '@/lib/utils'

import { formatTokens } from '../lib/format'
import type { ModelRanking, RankingPeriod } from '../types'
import { ModelLink, VendorLink } from './entity-links'
import { GrowthText } from './growth-text'

const PERIOD_OPTIONS: { id: RankingPeriod; days: number }[] = [
  { id: 'today', days: 1 },
  { id: 'week', days: 7 },
  { id: 'month', days: 30 },
]

const MEDAL_COLORS = [
  'bg-amber-400/20 text-amber-700 dark:text-amber-300 border-amber-400/40',
  'bg-slate-300/25 text-slate-600 dark:text-slate-300 border-slate-400/40',
  'bg-orange-400/20 text-orange-700 dark:text-orange-300 border-orange-400/40',
]
const MEDAL_COUNT = MEDAL_COLORS.length

type SortKey = 'calls' | 'tokens'

const SORT_OPTIONS: { id: SortKey; labelKey: string }[] = [
  { id: 'calls', labelKey: 'By calls' },
  { id: 'tokens', labelKey: 'By tokens' },
]

type ModelsSectionProps = {
  rows: ModelRanking[]
  period: RankingPeriod
  onPeriodChange: (period: RankingPeriod) => void
  /** Window covered by the rows (unix seconds). */
  startTs?: number
  endTs?: number
  isLoading?: boolean
}

/**
 * 模型排行：单列排行榜（与「热门用户」结构一致）。
 * 支持按调用次数（默认）或 token 用量排序，次数作为主指标加粗突出。
 */
export function ModelsSection(props: ModelsSectionProps) {
  const { t } = useTranslation()
  const [sortKey, setSortKey] = useState<SortKey>('calls')

  const sortedRows = useMemo(() => {
    const rows = [...props.rows]
    if (sortKey === 'calls') {
      return rows.sort((a, b) => b.calls - a.calls)
    }
    return rows.sort((a, b) => b.total_tokens - a.total_tokens)
  }, [props.rows, sortKey])

  const totalCalls = useMemo(
    () => sortedRows.reduce((sum, r) => sum + r.calls, 0),
    [sortedRows]
  )

  const totalTokens = useMemo(
    () => sortedRows.reduce((sum, r) => sum + r.total_tokens, 0),
    [sortedRows]
  )

  const maxMetric = useMemo(() => {
    if (sortedRows.length === 0) {
      return 1
    }
    const values = sortedRows.map((r) =>
      sortKey === 'calls' ? r.calls : r.total_tokens
    )
    return Math.max(...values, 1)
  }, [sortedRows, sortKey])

  const rangeLabel = useMemo(() => {
    if (!props.startTs || !props.endTs) {
      return ''
    }
    return `${dayjs.unix(props.startTs).format('MM-DD HH:mm')} ~ ${dayjs.unix(props.endTs).format('MM-DD HH:mm')}`
  }, [props.startTs, props.endTs])

  function rankBadge(index: number): ReactNode {
    if (index < MEDAL_COUNT) {
      return (
        <span
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-full border',
            MEDAL_COLORS[index]
          )}
        >
          <Crown className='size-3' />
        </span>
      )
    }
    return (
      <span className='text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold'>
        {index + 1}
      </span>
    )
  }

  function renderRow(row: ModelRanking, index: number): ReactNode {
    const metric = sortKey === 'calls' ? row.calls : row.total_tokens
    const barPct = Math.max(2, (metric / maxMetric) * 100)

    return (
      <tr key={row.model_name} className='hover:bg-muted/30'>
        <td className='px-3 py-2'>{rankBadge(index)}</td>
        <td className='max-w-[320px] px-3 py-2'>
          <div className='flex min-w-0 flex-col'>
            <ModelLink
              modelName={row.model_name}
              className='truncate font-mono text-xs font-medium'
            >
              {row.model_name}
            </ModelLink>
            <VendorLink
              vendor={row.vendor}
              className='text-muted-foreground/80 truncate text-[10px] italic'
            >
              {row.vendor.toLowerCase()}
            </VendorLink>
          </div>
        </td>
        <td className='px-3 py-2'>
          <div
            className='bg-muted h-1.5 w-[110px] overflow-hidden rounded-full'
            title={`${t('Share of the top model')}: ${Math.round((metric / maxMetric) * 100)}%`}
          >
            <div
              className='bg-primary/70 h-full rounded-full transition-[width] duration-500'
              style={{ width: `${barPct}%` }}
            />
          </div>
        </td>
        <td className='px-3 py-2 text-right'>
          <span className='text-foreground font-mono text-sm font-semibold tabular-nums'>
            {row.calls.toLocaleString()}
          </span>
        </td>
        <td className='text-muted-foreground px-3 py-2 text-right tabular-nums'>
          {formatTokens(row.total_tokens)}
        </td>
        <td className='px-3 py-2 text-right'>
          <GrowthText value={row.growth_pct} className='text-[11px]' />
        </td>
      </tr>
    )
  }

  function renderBody(): ReactNode {
    if (props.isLoading) {
      return (
        <div className='space-y-2'>
          {['s1', 's2', 's3', 's4', 's5'].map((key) => (
            <Skeleton key={key} className='h-14 w-full rounded-lg' />
          ))}
        </div>
      )
    }
    if (sortedRows.length === 0) {
      return (
        <div className='text-muted-foreground rounded-xl border border-dashed px-6 py-10 text-center text-sm'>
          {t('No data for this period')}
        </div>
      )
    }
    return (
      <div className='bg-card overflow-hidden rounded-xl border shadow-sm'>
        <div className='overflow-x-auto'>
          <table className='w-full min-w-[680px] text-xs'>
            <thead>
              <tr className='bg-muted/40 text-muted-foreground border-b text-[11px]'>
                <th className='w-14 px-3 py-2 text-left font-medium'>
                  {t('Rank')}
                </th>
                <th className='px-3 py-2 text-left font-medium'>{t('Model')}</th>
                <th className='px-3 py-2 text-left font-medium'>
                  {sortKey === 'calls' ? t('Calls share') : t('Usage share')}
                </th>
                <th className='px-3 py-2 text-right font-medium'>
                  {t('Calls')}
                </th>
                <th className='px-3 py-2 text-right font-medium'>
                  {t('Tokens')}
                </th>
                <th className='px-3 py-2 text-right font-medium'>
                  {t('Growth')}
                </th>
              </tr>
            </thead>
            <tbody className='divide-y'>
              {sortedRows.map((row, index) => renderRow(row, index))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='flex items-center gap-2'>
          <Trophy className='text-primary size-5' />
          <h2 className='text-lg font-semibold'>{t('Model Ranking')}</h2>
          <span className='text-muted-foreground text-xs'>
            {t('Models used in this period, ranked automatically')}
          </span>
        </div>
        <div className='flex flex-col items-end gap-1'>
          <div className='bg-muted/60 inline-flex rounded-lg p-0.5'>
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.id}
                type='button'
                onClick={() => props.onPeriodChange(option.id)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  option.id === props.period
                    ? 'bg-background shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {t('Last N days', { n: option.days })}
              </button>
            ))}
          </div>
          {rangeLabel !== '' && (
            <span className='text-muted-foreground flex items-center gap-1 text-[11px] tabular-nums'>
              <CalendarRange className='size-3' />
              {rangeLabel}
            </span>
          )}
        </div>
      </div>

      <div className='grid gap-3 sm:grid-cols-3'>
        <StatCard
          label={t('Listed models')}
          value={sortedRows.length.toLocaleString()}
        />
        <StatCard label={t('Total calls')} value={totalCalls.toLocaleString()} />
        <StatCard label={t('Total tokens')} value={formatTokens(totalTokens)} />
      </div>

      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='bg-muted/60 inline-flex rounded-lg p-0.5'>
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.id}
              type='button'
              onClick={() => setSortKey(option.id)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                option.id === sortKey
                  ? 'bg-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t(option.labelKey)}
            </button>
          ))}
        </div>
        <span className='text-muted-foreground text-[11px]'>
          {sortKey === 'calls'
            ? t('Ranked by call count')
            : t('Ranked by token usage')}
        </span>
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
