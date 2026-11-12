import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import dayjs from '@/lib/dayjs'
import { cn } from '@/lib/utils'

import {
  getKeyQuotaKeys,
  getKeyQuotaOverview,
  probeKeyBalances,
  resetKeyQuotaGuard,
  updateKeyBalanceProbe,
  updateKeyQuotaGuard,
  type KeyQuotaChannel,
  type KeyQuotaKeyStatus,
} from './api'

const KEY_STATUS_STYLE: Record<number, string> = {
  1: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  2: 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
  3: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
}

const KEY_STATUS_LABEL: Record<number, string> = {
  1: 'Available',
  2: 'Manually disabled',
  3: 'Auto-disabled',
}

const STATUS_FILTERS: { id: KeyQuotaKeyStatus; labelKey: string }[] = [
  { id: 'all', labelKey: 'All' },
  { id: 'available', labelKey: 'Available' },
  { id: 'auto', labelKey: 'Auto-disabled' },
  { id: 'manual', labelKey: 'Manually disabled' },
]

const PAGE_SIZE = 20

/** 多 key 渠道的额度保护：配置、余额、key 明细（脱敏、分页、可筛选）。 */
export function KeyQuotaPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [channelId, setChannelId] = useState<number | null>(null)
  const [status, setStatus] = useState<KeyQuotaKeyStatus>('all')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [probing, setProbing] = useState(false)

  const overview = useQuery({
    queryKey: ['key-quota-overview'],
    queryFn: getKeyQuotaOverview,
    refetchInterval: 60_000,
  })
  const channels: KeyQuotaChannel[] = overview.data?.data ?? []
  const active = channels.find((ch) => ch.id === channelId) ?? channels[0]

  const keysQuery = useQuery({
    queryKey: ['key-quota-keys', active?.id, page, status, keyword],
    queryFn: () =>
      getKeyQuotaKeys({
        channelId: Number(active?.id),
        page,
        pageSize: PAGE_SIZE,
        status,
        keyword,
      }),
    enabled: Boolean(active?.id),
    refetchInterval: 60_000,
  })

  const summary = keysQuery.data?.data?.summary ?? active
  const items = keysQuery.data?.data?.items ?? []
  const total = keysQuery.data?.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  async function refreshAll() {
    if (!active) {
      return
    }
    setProbing(true)
    try {
      const res = await probeKeyBalances(active.id)
      if (res?.success) {
        toast.success(res.message || t('Saved'))
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['key-quota-overview'] }),
          queryClient.invalidateQueries({ queryKey: ['key-quota-keys'] }),
        ])
      } else {
        toast.error(res?.message || t('Save failed'))
      }
    } catch {
      toast.error(t('Save failed'))
    } finally {
      setProbing(false)
    }
  }

  async function probeOne(index: number) {
    if (!active) {
      return
    }
    const res = await probeKeyBalances(active.id, index)
    if (res?.success) {
      await queryClient.invalidateQueries({ queryKey: ['key-quota-keys'] })
    } else {
      toast.error(res?.message || t('Save failed'))
    }
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Key Quota Guard')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        {overview.isLoading ? (
          <Skeleton className='h-64 w-full rounded-xl' />
        ) : channels.length === 0 ? (
          <div className='text-muted-foreground flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-10 text-center text-sm'>
            <span>{t('No channel has quota guard enabled')}</span>
            <span className='text-xs'>
              {t(
                'Open Channels, edit a multi-key channel, and switch on “Key Quota Guard” to see it here.'
              )}
            </span>
          </div>
        ) : (
          <div className='flex w-full flex-col gap-4'>
            {channels.length > 1 && (
              <div className='bg-muted/60 inline-flex flex-wrap rounded-lg p-0.5'>
                {channels.map((channel) => (
                  <button
                    key={channel.id}
                    type='button'
                    onClick={() => {
                      setChannelId(channel.id)
                      setPage(1)
                    }}
                    className={cn(
                      'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                      channel.id === active?.id
                        ? 'bg-background shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {channel.name}
                    <span className='text-muted-foreground ms-1'>
                      #{channel.id}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {active && (
              <ConfigCard
                key={active.id}
                channel={active}
                onChanged={async () => {
                  await Promise.all([
                    queryClient.invalidateQueries({
                      queryKey: ['key-quota-overview'],
                    }),
                    queryClient.invalidateQueries({
                      queryKey: ['key-quota-keys'],
                    }),
                  ])
                }}
              />
            )}

            <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
              <StatCard
                label={t('Estimated calls left today')}
                value={
                  active?.enabled
                    ? `~${(summary?.estimated_remaining_calls ?? 0).toLocaleString()} / ${(summary?.total_capacity_calls ?? 0).toLocaleString()}`
                    : '—'
                }
                hint={`${t('Used today')}: ${(summary?.today_calls ?? 0).toLocaleString()}`}
              />
              <StatCard
                label={t('Available keys')}
                value={`${summary?.usable_keys ?? 0}/${summary?.total_keys ?? 0}`}
                hint={`${t('Auto-disabled')}: ${summary?.auto_disabled_keys ?? 0}`}
              />
              <StatCard
                label={t('Balance total')}
                value={(summary?.balance_sum ?? 0).toLocaleString()}
                hint={
                  summary?.balance_updated_at
                    ? `${t('Updated')}: ${dayjs.unix(summary.balance_updated_at).format('MM-DD HH:mm')}`
                    : t('Never updated')
                }
              />
              <div className='bg-card flex flex-col justify-center gap-1 rounded-xl border px-4 py-3 shadow-sm'>
                <div className='text-muted-foreground text-[11px]'>
                  {t('Manual check')}
                </div>
                <Button
                  size='sm'
                  variant='outline'
                  className='h-8'
                  disabled={probing}
                  onClick={() => {
                    void refreshAll()
                  }}
                >
                  <RefreshCw
                    className={cn('mr-1 size-3.5', probing && 'animate-spin')}
                  />
                  {probing ? t('Checking…') : t('Check all balances')}
                </Button>
              </div>
            </div>

            <div className='flex flex-wrap items-center justify-between gap-2'>
              <div className='bg-muted/60 inline-flex flex-wrap rounded-lg p-0.5'>
                {STATUS_FILTERS.map((filter) => (
                  <button
                    key={filter.id}
                    type='button'
                    onClick={() => {
                      setStatus(filter.id)
                      setPage(1)
                    }}
                    className={cn(
                      'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                      filter.id === status
                        ? 'bg-background shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {t(filter.labelKey)}
                  </button>
                ))}
              </div>
              <Input
                value={keyword}
                onChange={(event) => {
                  setKeyword(event.target.value)
                  setPage(1)
                }}
                placeholder={t('Search masked key')}
                className='h-8 w-48'
              />
            </div>

            <div className='bg-card overflow-hidden rounded-xl border shadow-sm'>
              <div className='overflow-x-auto'>
                <table className='w-full min-w-[860px] text-xs'>
                  <thead>
                    <tr className='bg-muted/40 text-muted-foreground border-b text-[11px]'>
                      <th className='w-12 px-3 py-2 text-left font-medium'>#</th>
                      <th className='px-3 py-2 text-left font-medium'>
                        {t('Key')}
                      </th>
                      <th className='px-3 py-2 text-left font-medium'>
                        {t('Status')}
                      </th>
                      <th className='px-3 py-2 text-right font-medium'>
                        {t('Balance')}
                      </th>
                      <th className='px-3 py-2 text-left font-medium'>
                        {t('Reason')}
                      </th>
                      <th className='px-3 py-2 text-right font-medium'>
                        {t('Disabled at')}
                      </th>
                      <th className='px-3 py-2 text-right font-medium'>
                        {t('Actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className='divide-y'>
                    {keysQuery.isLoading ? (
                      <tr>
                        <td
                          colSpan={7}
                          className='text-muted-foreground px-3 py-8 text-center'
                        >
                          {t('Loading…')}
                        </td>
                      </tr>
                    ) : items.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className='text-muted-foreground px-3 py-8 text-center'
                        >
                          {t('No data for this filter')}
                        </td>
                      </tr>
                    ) : (
                      items.map((key) => (
                        <tr key={key.index} className='hover:bg-muted/30'>
                          <td className='text-muted-foreground px-3 py-1.5'>
                            {key.index}
                          </td>
                          <td className='px-3 py-1.5 font-mono'>{key.masked}</td>
                          <td className='px-3 py-1.5'>
                            <span
                              className={cn(
                                'rounded px-1.5 py-0.5 text-[10px] font-medium',
                                KEY_STATUS_STYLE[key.status] ??
                                  KEY_STATUS_STYLE[2]
                              )}
                            >
                              {t(
                                KEY_STATUS_LABEL[key.status] ??
                                  KEY_STATUS_LABEL[2]
                              )}
                            </span>
                          </td>
                          <td className='px-3 py-1.5 text-right tabular-nums'>
                            {key.balance_error ? (
                              <span
                                className='text-destructive/80 text-[10px]'
                                title={key.balance_error}
                              >
                                {t('Failed')}
                              </span>
                            ) : key.balance_at ? (
                              <span
                                className={cn(
                                  'font-semibold',
                                  key.balance <= 0 && 'text-destructive'
                                )}
                              >
                                {key.balance.toLocaleString()}
                              </span>
                            ) : (
                              <span className='text-muted-foreground/60'>-</span>
                            )}
                          </td>
                          <td
                            className='text-muted-foreground max-w-[200px] truncate px-3 py-1.5'
                            title={key.reason}
                          >
                            {key.reason || '-'}
                          </td>
                          <td className='text-muted-foreground px-3 py-1.5 text-right tabular-nums'>
                            {key.disabled_at
                              ? dayjs.unix(key.disabled_at).format('MM-DD HH:mm')
                              : '-'}
                          </td>
                          <td className='px-3 py-1.5 text-right'>
                            <Button
                              size='sm'
                              variant='ghost'
                              className='h-6 px-2 text-[11px]'
                              onClick={() => {
                                void probeOne(key.index)
                              }}
                            >
                              {t('Check')}
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className='flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2'>
                <span className='text-muted-foreground text-[11px]'>
                  {t('Total')}: {total} · {page}/{totalPages}
                </span>
                <div className='flex items-center gap-1'>
                  <Button
                    size='sm'
                    variant='outline'
                    className='h-7'
                    disabled={page <= 1}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                  >
                    <ChevronLeft className='size-3.5' />
                  </Button>
                  <Button
                    size='sm'
                    variant='outline'
                    className='h-7'
                    disabled={page >= totalPages}
                    onClick={() =>
                      setPage((value) => Math.min(totalPages, value + 1))
                    }
                  >
                    <ChevronRight className='size-3.5' />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

function ConfigCard(props: {
  channel: KeyQuotaChannel
  onChanged: () => void | Promise<void>
}) {
  const { t } = useTranslation()
  const channel = props.channel
  const [enabled, setEnabled] = useState(channel.enabled)
  const [dailyQuota, setDailyQuota] = useState(
    String(channel.daily_quota_per_key || 250)
  )
  const [costPerCall, setCostPerCall] = useState(
    String(channel.cost_per_call || 2)
  )
  const [probeEnabled, setProbeEnabled] = useState(channel.probe_enabled)
  const [probeInterval, setProbeInterval] = useState(
    String(channel.probe_interval_minutes || 30)
  )
  const [saving, setSaving] = useState(false)
  const [resetting, setResetting] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const guardRes = await updateKeyQuotaGuard(channel.id, {
        enabled,
        daily_quota_per_key: Number(dailyQuota) || 250,
        cost_per_call: Number(costPerCall) || 2,
      })
      const probeRes = await updateKeyBalanceProbe(channel.id, {
        enabled: probeEnabled,
        interval_minutes: Number(probeInterval) || 30,
      })
      if (guardRes?.success && probeRes?.success) {
        toast.success(t('Saved'))
        await props.onChanged()
      } else {
        toast.error(guardRes?.message || probeRes?.message || t('Save failed'))
      }
    } catch {
      toast.error(t('Save failed'))
    } finally {
      setSaving(false)
    }
  }

  async function handleReset() {
    setResetting(true)
    try {
      const res = await resetKeyQuotaGuard(channel.id)
      if (res?.success) {
        toast.success(res.message || t('Saved'))
        await props.onChanged()
      } else {
        toast.error(res?.message || t('Save failed'))
      }
    } catch {
      toast.error(t('Save failed'))
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className='bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-sm'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='flex items-center gap-2'>
          <ShieldCheck
            className={cn(
              'size-5',
              enabled ? 'text-primary' : 'text-muted-foreground/50'
            )}
          />
          <div className='text-sm font-semibold'>
            {channel.name}{' '}
            <span className='text-muted-foreground font-normal'>
              #{channel.id}
            </span>
          </div>
        </div>
        <div className='flex flex-wrap items-center gap-4'>
          <label className='flex items-center gap-2 text-xs'>
            <span className='text-muted-foreground'>
              {t('Enable quota guard')}
            </span>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </label>
          <label className='flex items-center gap-2 text-xs'>
            <span className='text-muted-foreground'>
              {t('Auto refresh balance')}
            </span>
            <Switch checked={probeEnabled} onCheckedChange={setProbeEnabled} />
            <Input
              value={probeInterval}
              onChange={(event) => setProbeInterval(event.target.value)}
              inputMode='numeric'
              className='h-7 w-14 text-center'
            />
            <span className='text-muted-foreground'>{t('min')}</span>
          </label>
        </div>
      </div>

      <div className='flex flex-wrap items-center gap-3'>
        <label className='flex items-center gap-2 text-xs'>
          <span className='text-muted-foreground'>
            {t('Daily quota per key')}
          </span>
          <Input
            value={dailyQuota}
            onChange={(event) => setDailyQuota(event.target.value)}
            inputMode='numeric'
            className='h-7 w-20 text-center'
          />
        </label>
        <label className='flex items-center gap-2 text-xs'>
          <span className='text-muted-foreground'>{t('Quota per call')}</span>
          <Input
            value={costPerCall}
            onChange={(event) => setCostPerCall(event.target.value)}
            inputMode='numeric'
            className='h-7 w-16 text-center'
          />
        </label>
        <div className='ms-auto flex items-center gap-2'>
          <Button
            size='sm'
            variant='outline'
            disabled={resetting}
            onClick={() => {
              void handleReset()
            }}
          >
            <RotateCcw className='mr-1 size-3.5' />
            {t('Restore auto-disabled keys now')}
          </Button>
          <Button
            size='sm'
            disabled={saving}
            onClick={() => {
              void handleSave()
            }}
          >
            <Save className='mr-1 size-3.5' />
            {t('Save')}
          </Button>
        </div>
      </div>
    </div>
  )
}

function StatCard(props: { label: string; value: string; hint?: string }) {
  return (
    <div className='bg-card rounded-xl border px-4 py-3 shadow-sm'>
      <div className='text-muted-foreground text-[11px]'>{props.label}</div>
      <div className='mt-0.5 text-lg font-semibold tabular-nums'>
        {props.value}
      </div>
      {props.hint && (
        <div className='text-muted-foreground/70 text-[10px]'>{props.hint}</div>
      )}
    </div>
  )
}
