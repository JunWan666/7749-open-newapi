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
import { CalendarRange } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import dayjs from '@/lib/dayjs'
import { cn } from '@/lib/utils'

import type { RankingPeriod } from '../types'

/** Same wording/labels as the Top Users tab: 近 1 天 / 近 7 天 / 近 30 天. */
const PERIODS: { id: RankingPeriod; days: number }[] = [
  { id: 'today', days: 1 },
  { id: 'week', days: 7 },
  { id: 'month', days: 30 },
]

type RankingsHeroProps = {
  period: RankingPeriod
  onPeriodChange: (period: RankingPeriod) => void
  /** Period switch only makes sense for the platform ranking tab. */
  showPeriod?: boolean
}

/**
 * Hero strip for the rankings page. Intentionally minimal — title +
 * subtitle + period tabs only.
 */
/**
 * Period switch (Today / Week / Month / Year). Rendered inside the platform tab
 * so that switching top-level tabs does not shift the page layout.
 */
export function RankingsPeriodTabs(props: {
  period: RankingPeriod
  onPeriodChange: (period: RankingPeriod) => void
  /** Window start/end (unix seconds) reported by the API. */
  startTs?: number
  endTs?: number
}) {
  const { t } = useTranslation()

  // Exact window shown as small print, mirroring the Top Users tab so both
  // tabs always explain what "近 N 天" actually covers.
  const rangeLabel = useMemo(() => {
    if (!props.startTs || !props.endTs) {
      return ''
    }
    return `${dayjs.unix(props.startTs).format('MM-DD HH:mm')} ~ ${dayjs.unix(props.endTs).format('MM-DD HH:mm')}`
  }, [props.startTs, props.endTs])

  return (
    <div className='border-border/60 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b'>
      <div
        role='tablist'
        aria-label={t('Period')}
        className='flex items-center'
      >
        {PERIODS.map((p) => {
          const isActive = props.period === p.id
          return (
            <button
              key={p.id}
              role='tab'
              type='button'
              aria-selected={isActive}
              onClick={() => props.onPeriodChange(p.id)}
              className={cn(
                'focus-visible:ring-ring/40 relative -mb-px rounded-sm px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none',
                isActive
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t('Last N days', { n: p.days })}
              <span
                aria-hidden
                className={cn(
                  'bg-foreground absolute inset-x-3 -bottom-px h-[2px] rounded-full transition-opacity',
                  isActive ? 'opacity-100' : 'opacity-0'
                )}
              />
            </button>
          )
        })}
      </div>
      {rangeLabel !== '' && (
        <span className='text-muted-foreground flex items-center gap-1 pb-1.5 text-[11px] tabular-nums'>
          <CalendarRange className='size-3' />
          {rangeLabel}
        </span>
      )}
    </div>
  )
}

export function RankingsHero(props: RankingsHeroProps) {
  const { t } = useTranslation()

  return (
    <section className='space-y-5'>
      <div className='space-y-2'>
        <h1 className='text-[clamp(1.75rem,4vw,2.5rem)] leading-[1.15] font-bold tracking-tight'>
          {t('Rankings')}
        </h1>
        <p className='text-muted-foreground/80 max-w-2xl text-sm'>
          {t(
            'Discover the most-used models and rising vendors on the platform, updated from live usage data.'
          )}
        </p>
      </div>

      {props.showPeriod !== false && (
        <RankingsPeriodTabs
          period={props.period}
          onPeriodChange={props.onPeriodChange}
        />
      )}
    </section>
  )
}
