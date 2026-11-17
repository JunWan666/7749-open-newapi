import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { ArrowLeft, CalendarRange } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { PublicLayout } from '@/components/layout'
import { PageTransition } from '@/components/page-transition'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import dayjs from '@/lib/dayjs'
import { cn } from '@/lib/utils'

import { formatTokens } from '../lib/format'

type UserDetailRow = {
  model: string
  calls: number
  quota: number
  tokens: number
}

type UserDetail = {
  user: string
  days: number
  total_calls: number
  total_quota: number
  total_tokens: number
  rows: UserDetailRow[]
}

const DAY_OPTIONS = [1, 7, 30] as const

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

async function fetchUserDetail(user: string, days: number): Promise<UserDetail> {
  const res = await fetch(
    `/rank-api/api/user_detail?user=${encodeURIComponent(user)}&days=${days}`
  )
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }
  return (await res.json()) as UserDetail
}

/** 热门用户详情：独立页面，展示某用户在各模型上的调用 / 消费 / token 分布。 */
export function UserDetailPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const search = useSearch({ from: '/rankings/user' }) as {
    user?: string
    days?: number
  }
  const user = search.user ?? ''
  const days = DAY_OPTIONS.includes((search.days ?? 1) as 1 | 7 | 30)
    ? (search.days ?? 1)
    : 1

  const query = useQuery({
    queryKey: ['rank-api', 'user-detail', user, days],
    queryFn: () => fetchUserDetail(user, days),
    enabled: user !== '',
    staleTime: 60_000,
  })

  const detail = query.data
  const rangeLabel = (() => {
    const now = dayjs()
    if (days <= 1) {
      return `${now.format('MM-DD')} 00:00 ~ ${now.format('MM-DD HH:mm')}`
    }
    return `${now.subtract(days, 'day').format('MM-DD HH:mm')} ~ ${now.format('MM-DD HH:mm')}`
  })()

  return (
    <PublicLayout showMainContainer={false}>
      <div className='relative'>
        <div
          aria-hidden
          className='pointer-events-none absolute inset-x-0 top-0 h-[600px] opacity-20 dark:opacity-[0.10]'
          style={{
            background: [
              'radial-gradient(ellipse 60% 50% at 20% 20%, oklch(0.72 0.18 250 / 80%) 0%, transparent 70%)',
              'radial-gradient(ellipse 50% 40% at 80% 15%, oklch(0.65 0.15 200 / 60%) 0%, transparent 70%)',
              'radial-gradient(ellipse 40% 35% at 50% 70%, oklch(0.70 0.12 280 / 40%) 0%, transparent 70%)',
            ].join(', '),
            maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to bottom, black 40%, transparent 100%)',
          }}
        />
        <PageTransition className='relative mx-auto w-full max-w-[1280px] space-y-6 px-3 pt-16 pb-10 sm:px-6 sm:pt-20 sm:pb-12 xl:px-8'>
        <div className='flex flex-wrap items-center justify-between gap-3'>
          <div className='flex flex-wrap items-center gap-3'>
            <Button
              size='sm'
              variant='outline'
              onClick={() => navigate({ to: '/rankings' })}
            >
              <ArrowLeft className='mr-1 size-3.5' />
              {t('Back')}
            </Button>
            <div className='space-y-1'>
              <h1 className='text-[clamp(1.5rem,3vw,2rem)] leading-[1.2] font-bold tracking-tight'>
                {user || '—'}
              </h1>
              <p className='text-muted-foreground/80 text-sm'>
                {t('Model usage in the selected period')}
              </p>
            </div>
          </div>

          <div className='flex flex-col items-end gap-1'>
            <div className='bg-muted/60 inline-flex rounded-lg p-0.5'>
              {DAY_OPTIONS.map((option) => (
                <button
                  key={option}
                  type='button'
                  onClick={() =>
                    navigate({
                      to: '/rankings/user',
                      search: { user, days: option },
                    })
                  }
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

        {query.isLoading ? (
          <Skeleton className='h-72 w-full rounded-xl' />
        ) : !detail ? (
          <div className='text-muted-foreground rounded-xl border border-dashed px-6 py-12 text-center text-sm'>
            {t('No data for this period')}
          </div>
        ) : (
          <>
            <div className='grid gap-3 sm:grid-cols-3'>
              <StatCard
                label={t('Total calls')}
                value={detail.total_calls.toLocaleString()}
              />
              <StatCard
                label={t('Total spend')}
                value={formatMoney(detail.total_quota)}
              />
              <StatCard
                label={t('Tokens')}
                value={formatTokens(detail.total_tokens)}
              />
            </div>

            <div className='bg-card overflow-hidden rounded-xl border shadow-sm'>
              <div className='overflow-x-auto'>
                <table className='w-full min-w-[720px] text-xs'>
                  <thead>
                    <tr className='bg-muted/40 text-muted-foreground border-b text-[11px]'>
                      <th className='w-12 px-4 py-2 text-left font-medium'>#</th>
                      <th className='px-4 py-2 text-left font-medium'>
                        {t('Model')}
                      </th>
                      <th className='w-28 px-4 py-2 text-right font-medium whitespace-nowrap'>
                        {t('Calls')}
                      </th>
                      <th className='w-32 px-4 py-2 text-right font-medium whitespace-nowrap'>
                        {t('Total spend')}
                      </th>
                      <th className='w-32 px-4 py-2 text-right font-medium whitespace-nowrap'>
                        Tokens
                      </th>
                    </tr>
                  </thead>
                  <tbody className='divide-y'>
                    {detail.rows.map((item, index) => (
                      <tr key={item.model || 'empty'} className='hover:bg-muted/30'>
                        <td className='text-muted-foreground px-4 py-2 tabular-nums'>
                          {index + 1}
                        </td>
                        <td className='px-4 py-2 font-mono'>{item.model || t('Unknown model')}</td>
                        <td className='px-4 py-2 text-right font-semibold tabular-nums'>
                          {item.calls.toLocaleString()}
                        </td>
                        <td className='text-muted-foreground px-4 py-2 text-right tabular-nums'>
                          {formatMoney(item.quota)}
                        </td>
                        <td className='text-muted-foreground px-4 py-2 text-right tabular-nums'>
                          {formatTokens(item.tokens)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className='text-muted-foreground border-t px-4 py-2 text-[11px]'>
                {t(
                  'Calls shown here are grouped by model for the selected period.'
                )}
              </div>
            </div>
          </>
        )}
        </PageTransition>
      </div>
    </PublicLayout>
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
