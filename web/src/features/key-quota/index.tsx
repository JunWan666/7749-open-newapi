import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RotateCcw, Save, ShieldCheck } from 'lucide-react'
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
  getKeyQuotaOverview,
  resetKeyQuotaGuard,
  updateKeyQuotaGuard,
  type KeyQuotaChannel,
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

/** 多 key 渠道的额度保护：开关、参数、key 状态（脱敏）与次日自动恢复。 */
export function KeyQuotaPage() {
  const { t } = useTranslation()
  const { data, isLoading } = useQuery({
    queryKey: ['key-quota-overview'],
    queryFn: getKeyQuotaOverview,
    refetchInterval: 60_000,
  })

  const channels = data?.data ?? []

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Key Quota Guard')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='flex max-w-4xl flex-col gap-5'>
          <p className='text-muted-foreground text-sm'>
            {t(
              'For multi-key channels only. When an upstream replies 429 with a quota message, just that one key is removed from the pool; every other channel and key is untouched. All auto-disabled keys return to the pool every day at 00:05.'
            )}
          </p>

          {isLoading ? (
            <Skeleton className='h-64 w-full rounded-xl' />
          ) : channels.length === 0 ? (
            <div className='text-muted-foreground rounded-xl border border-dashed px-6 py-10 text-center text-sm'>
              {t('No multi-key channels found')}
            </div>
          ) : (
            channels.map((channel) => (
              <ChannelQuotaCard key={channel.id} channel={channel} />
            ))
          )}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

function ChannelQuotaCard(props: { channel: KeyQuotaChannel }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const channel = props.channel
  const [enabled, setEnabled] = useState(channel.enabled)
  const [dailyQuota, setDailyQuota] = useState(
    String(channel.daily_quota_per_key || 250)
  )
  const [costPerCall, setCostPerCall] = useState(
    String(channel.cost_per_call || 2)
  )
  const [saving, setSaving] = useState(false)
  const [showKeys, setShowKeys] = useState(false)

  const dirty =
    enabled !== channel.enabled ||
    dailyQuota !== String(channel.daily_quota_per_key || 250) ||
    costPerCall !== String(channel.cost_per_call || 2)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await updateKeyQuotaGuard(channel.id, {
        enabled,
        daily_quota_per_key: Number(dailyQuota) || 250,
        cost_per_call: Number(costPerCall) || 2,
      })
      if (res?.success) {
        toast.success(t('Saved'))
        await queryClient.invalidateQueries({ queryKey: ['key-quota-overview'] })
      } else {
        toast.error(res?.message || t('Save failed'))
      }
    } catch {
      toast.error(t('Save failed'))
    } finally {
      setSaving(false)
    }
  }

  async function handleReset() {
    try {
      const res = await resetKeyQuotaGuard(channel.id)
      if (res?.success) {
        toast.success(res.message || t('Saved'))
        await queryClient.invalidateQueries({ queryKey: ['key-quota-overview'] })
      } else {
        toast.error(res?.message || t('Save failed'))
      }
    } catch {
      toast.error(t('Save failed'))
    }
  }

  return (
    <div className='bg-card flex flex-col gap-4 rounded-xl border p-4 shadow-sm'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='flex items-center gap-2'>
          <ShieldCheck
            className={cn(
              'size-5',
              channel.enabled ? 'text-primary' : 'text-muted-foreground/50'
            )}
          />
          <div>
            <div className='text-sm font-semibold'>
              {channel.name}{' '}
              <span className='text-muted-foreground font-normal'>
                #{channel.id}
              </span>
            </div>
            <div className='text-muted-foreground text-xs'>
              {t('Keys available')}: {channel.usable_keys}/{channel.total_keys}
              {channel.auto_disabled_keys > 0 && (
                <>
                  {' · '}
                  <span className='text-destructive'>
                    {t('Auto-disabled')}: {channel.auto_disabled_keys}
                  </span>
                </>
              )}
              {channel.manual_disabled_keys > 0 && (
                <>
                  {' · '}
                  {t('Manually disabled')}: {channel.manual_disabled_keys}
                </>
              )}
            </div>
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <span className='text-muted-foreground text-xs'>
            {t('Enable quota guard')}
          </span>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </div>

      <div className='grid gap-3 sm:grid-cols-3'>
        <StatCard
          label={t('Estimated calls left today')}
          value={
            channel.enabled
              ? channel.estimated_remaining_calls.toLocaleString()
              : '—'
          }
          hint={t('available keys × daily calls per key')}
        />
        <label className='flex flex-col gap-1'>
          <span className='text-muted-foreground text-[11px]'>
            {t('Daily quota per key')}
          </span>
          <Input
            value={dailyQuota}
            onChange={(event) => setDailyQuota(event.target.value)}
            inputMode='numeric'
            className='h-9'
          />
        </label>
        <label className='flex flex-col gap-1'>
          <span className='text-muted-foreground text-[11px]'>
            {t('Quota per call')}
          </span>
          <Input
            value={costPerCall}
            onChange={(event) => setCostPerCall(event.target.value)}
            inputMode='numeric'
            className='h-9'
          />
        </label>
      </div>

      <div className='flex flex-wrap items-center justify-between gap-2'>
        <Button
          size='sm'
          variant='outline'
          onClick={() => setShowKeys((value) => !value)}
        >
          {showKeys ? t('Hide keys') : t('Show keys')} ({channel.total_keys})
        </Button>
        <div className='flex items-center gap-2'>
          <Button
            size='sm'
            variant='outline'
            onClick={() => {
              void handleReset()
            }}
          >
            <RotateCcw className='mr-1 size-3.5' />
            {t('Restore auto-disabled keys now')}
          </Button>
          <Button
            size='sm'
            disabled={saving || !dirty}
            onClick={() => {
              void handleSave()
            }}
          >
            <Save className='mr-1 size-3.5' />
            {t('Save')}
          </Button>
        </div>
      </div>

      {showKeys && (
        <div className='overflow-x-auto rounded-lg border'>
          <table className='w-full min-w-[560px] text-xs'>
            <thead>
              <tr className='bg-muted/40 text-muted-foreground border-b text-[11px]'>
                <th className='px-3 py-2 text-left font-medium'>#</th>
                <th className='px-3 py-2 text-left font-medium'>{t('Key')}</th>
                <th className='px-3 py-2 text-left font-medium'>
                  {t('Status')}
                </th>
                <th className='px-3 py-2 text-left font-medium'>{t('Reason')}</th>
                <th className='px-3 py-2 text-right font-medium'>
                  {t('Disabled at')}
                </th>
              </tr>
            </thead>
            <tbody className='divide-y'>
              {channel.keys.map((key) => (
                <tr key={key.index} className='hover:bg-muted/30'>
                  <td className='text-muted-foreground px-3 py-1.5'>
                    {key.index}
                  </td>
                  <td className='px-3 py-1.5 font-mono'>{key.masked}</td>
                  <td className='px-3 py-1.5'>
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-[10px] font-medium',
                        KEY_STATUS_STYLE[key.status] ?? KEY_STATUS_STYLE[2]
                      )}
                    >
                      {t(KEY_STATUS_LABEL[key.status] ?? KEY_STATUS_LABEL[2])}
                    </span>
                  </td>
                  <td
                    className='text-muted-foreground max-w-[220px] truncate px-3 py-1.5'
                    title={key.reason}
                  >
                    {key.reason || '-'}
                  </td>
                  <td className='text-muted-foreground px-3 py-1.5 text-right tabular-nums'>
                    {key.disabled_at
                      ? dayjs.unix(key.disabled_at).format('MM-DD HH:mm')
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function StatCard(props: { label: string; value: string; hint?: string }) {
  return (
    <div className='bg-muted/30 rounded-lg border px-3 py-2'>
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
