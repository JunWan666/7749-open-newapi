import { useQueryClient } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

type GuardConfig = {
  enabled: boolean
  daily_quota_per_key: number
  cost_per_call: number
}

/**
 * 渠道编辑抽屉里的「Key 额度保护」开关。
 *
 * 独立保存：改动后立即调用 /api/channel/:id/key_quota，不参与主表单提交，
 * 避免覆盖 channel_info 里的其他 fork 字段。
 */
export function KeyQuotaGuardSection(props: {
  channelId: number
  guard?: GuardConfig | null
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [config, setConfig] = useState<GuardConfig>({
    enabled: props.guard?.enabled ?? false,
    daily_quota_per_key: props.guard?.daily_quota_per_key || 250,
    cost_per_call: props.guard?.cost_per_call || 2,
  })
  const [saving, setSaving] = useState(false)

  async function save(next: GuardConfig) {
    setConfig(next)
    setSaving(true)
    try {
      const res = await api.put(`/api/channel/${props.channelId}/key_quota`, {
        enabled: next.enabled,
        daily_quota_per_key: Number(next.daily_quota_per_key) || 250,
        cost_per_call: Number(next.cost_per_call) || 2,
      })
      if (res.data?.success) {
        toast.success(t('Saved'))
        await queryClient.invalidateQueries({ queryKey: ['key-quota-overview'] })
        await queryClient.invalidateQueries({ queryKey: ['key-quota-keys'] })
      } else {
        toast.error(res.data?.message || t('Save failed'))
      }
    } catch {
      toast.error(t('Save failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border p-3',
        config.enabled ? 'border-primary/30 bg-primary/5' : 'border-dashed'
      )}
    >
      <div className='flex items-center justify-between gap-3'>
        <div className='flex items-center gap-2'>
          <ShieldCheck
            className={cn(
              'size-4',
              config.enabled ? 'text-primary' : 'text-muted-foreground/60'
            )}
          />
          <span className='text-sm font-semibold'>{t('Key Quota Guard')}</span>
        </div>
        <div className='flex items-center gap-2'>
          {saving && (
            <span className='text-muted-foreground text-[10px]'>
              {t('Saving…')}
            </span>
          )}
          <Switch
            checked={config.enabled}
            disabled={saving}
            onCheckedChange={(checked) => {
              void save({ ...config, enabled: Boolean(checked) })
            }}
          />
        </div>
      </div>

      <p className='text-muted-foreground text-[11px] leading-relaxed'>
        {t(
          'When enabled, a key that hits a 429 quota error is removed from the pool (only that key); every auto-disabled key returns to the pool daily at 00:05. Enable it to see this channel on the Key Quota Guard page.'
        )}
      </p>

      {config.enabled && (
        <div className='flex flex-wrap items-center gap-3'>
          <label className='flex items-center gap-2 text-[11px]'>
            <span className='text-muted-foreground'>
              {t('Daily quota per key')}
            </span>
            <Input
              value={String(config.daily_quota_per_key)}
              onChange={(event) =>
                setConfig({
                  ...config,
                  daily_quota_per_key: Number(event.target.value) || 0,
                })
              }
              onBlur={() => {
                void save(config)
              }}
              inputMode='numeric'
              disabled={saving}
              className='h-7 w-20 text-center'
            />
          </label>
          <label className='flex items-center gap-2 text-[11px]'>
            <span className='text-muted-foreground'>{t('Quota per call')}</span>
            <Input
              value={String(config.cost_per_call)}
              onChange={(event) =>
                setConfig({
                  ...config,
                  cost_per_call: Number(event.target.value) || 0,
                })
              }
              onBlur={() => {
                void save(config)
              }}
              inputMode='numeric'
              disabled={saving}
              className='h-7 w-16 text-center'
            />
          </label>
        </div>
      )}
    </div>
  )
}
