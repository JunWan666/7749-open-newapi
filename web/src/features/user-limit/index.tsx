import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Save, Search, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

import {
  getUserLimitConfig,
  saveUserLimitConfig,
  searchUsers,
  type UserLimitConfig,
  type UserLimitRule,
} from './api'

const selectClass =
  'border-input h-8 rounded-md border bg-transparent px-2 text-xs outline-none'

/** 单用户每日调用限额：按模型或整渠道限制次数，可加豁免用户。 */
export function UserLimitPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<UserLimitConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<
    { id: number; username: string }[]
  >([])

  const { data, isLoading } = useQuery({
    queryKey: ['user-limit-config'],
    queryFn: getUserLimitConfig,
    staleTime: 0,
    refetchInterval: 60_000,
  })

  const config: UserLimitConfig | null = draft ?? data?.data?.config ?? null
  const channels = data?.data?.channels ?? []
  const usage = data?.data?.usage ?? []

  function patchConfig(patch: Partial<UserLimitConfig>) {
    if (!config) {
      return
    }
    setDraft({ ...config, ...patch })
  }

  function patchRule(index: number, patch: Partial<UserLimitRule>) {
    if (!config) {
      return
    }
    setDraft({
      ...config,
      rules: config.rules.map((rule, i) =>
        i === index ? { ...rule, ...patch } : rule
      ),
    })
  }

  function addRule() {
    if (!config) {
      return
    }
    const firstChannel = channels[0]
    setDraft({
      ...config,
      rules: [
        ...config.rules,
        {
          channel_id: firstChannel?.id ?? 0,
          model: firstChannel?.models[0] ?? '',
          daily_calls: 1000,
        },
      ],
    })
  }

  function removeRule(index: number) {
    if (!config) {
      return
    }
    setDraft({ ...config, rules: config.rules.filter((_, i) => i !== index) })
  }

  async function handleSearch() {
    if (!keyword.trim()) {
      return
    }
    setSearching(true)
    try {
      const items = await searchUsers(keyword.trim())
      setResults(items.map((item) => ({ id: item.id, username: item.username })))
      if (items.length === 0) {
        toast.info(t('No matching users'))
      }
    } catch {
      toast.error(t('Search failed'))
    } finally {
      setSearching(false)
    }
  }

  function addExempt(userId: number) {
    if (!config || config.exempt_users.includes(userId)) {
      return
    }
    setDraft({ ...config, exempt_users: [...config.exempt_users, userId] })
  }

  function removeExempt(userId: number) {
    if (!config) {
      return
    }
    setDraft({
      ...config,
      exempt_users: config.exempt_users.filter((id) => id !== userId),
    })
  }

  async function handleSave() {
    if (!config) {
      return
    }
    setSaving(true)
    try {
      const res = await saveUserLimitConfig(config)
      if (res?.success) {
        toast.success(t('Saved'))
        setDraft(null)
        await queryClient.invalidateQueries({ queryKey: ['user-limit-config'] })
      } else {
        toast.error(res?.message || t('Save failed'))
      }
    } catch {
      toast.error(t('Save failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Daily Call Limit')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Button
          size='sm'
          disabled={saving || !config}
          onClick={() => {
            void handleSave()
          }}
        >
          <Save className='mr-1.5 size-4' />
          {t('Save')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        {isLoading || !config ? (
          <Skeleton className='h-80 w-full rounded-xl' />
        ) : (
          <div className='flex w-full flex-col gap-4'>
            <div className='bg-card flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 shadow-sm'>
              <div>
                <div className='text-sm font-semibold'>
                  {t('Enable daily call limit')}
                </div>
                <div className='text-muted-foreground text-xs'>
                  {t(
                    'Each user gets a per-day call cap on the configured models or channels. Root and exempt users are not limited.'
                  )}
                </div>
              </div>
              <Switch
                checked={config.enabled}
                onCheckedChange={(checked) =>
                  patchConfig({ enabled: Boolean(checked) })
                }
              />
            </div>

            <div className='bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-sm'>
              <div className='flex items-center justify-between gap-3'>
                <div className='text-sm font-semibold'>{t('Rules')}</div>
                <Button size='sm' variant='outline' onClick={addRule}>
                  <Plus className='mr-1 size-3.5' />
                  {t('Add rule')}
                </Button>
              </div>

              {config.rules.length === 0 ? (
                <div className='text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center text-xs'>
                  {t('No rules yet')}
                </div>
              ) : (
                config.rules.map((rule, index) => (
                  <RuleRow
                    key={`rule-${index}`}
                    rule={rule}
                    channels={channels}
                    onChange={(patch) => patchRule(index, patch)}
                    onRemove={() => removeRule(index)}
                  />
                ))
              )}
            </div>

            <div className='bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-sm'>
              <div className='text-sm font-semibold'>
                {t('Exempt users')}
                <span className='text-muted-foreground ms-2 text-xs font-normal'>
                  {t('These users are never limited')}
                </span>
              </div>
              <div className='flex flex-wrap items-center gap-2'>
                <Input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault()
                      void handleSearch()
                    }
                  }}
                  placeholder={t('Search username')}
                  className='h-8 w-56'
                />
                <Button
                  size='sm'
                  variant='outline'
                  disabled={searching}
                  onClick={() => {
                    void handleSearch()
                  }}
                >
                  <Search className='mr-1 size-3.5' />
                  {t('Search')}
                </Button>
              </div>

              {results.length > 0 && (
                <div className='flex flex-wrap gap-1.5'>
                  {results.map((item) => (
                    <button
                      key={item.id}
                      type='button'
                      onClick={() => addExempt(item.id)}
                      className='hover:bg-muted rounded-md border px-2 py-1 text-[11px]'
                    >
                      {item.username} #{item.id} +
                    </button>
                  ))}
                </div>
              )}

              <div className='flex flex-wrap gap-1.5'>
                {config.exempt_users.length === 0 ? (
                  <span className='text-muted-foreground text-xs'>
                    {t('No exempt users')}
                  </span>
                ) : (
                  config.exempt_users.map((id) => (
                    <span
                      key={id}
                      className='inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-1 text-[11px]'
                    >
                      #{id}
                      <button
                        type='button'
                        aria-label={t('Remove')}
                        onClick={() => removeExempt(id)}
                      >
                        <X className='size-3' />
                      </button>
                    </span>
                  ))
                )}
              </div>
            </div>

            <div className='bg-card overflow-hidden rounded-xl border shadow-sm'>
              <div className='border-b px-4 py-2 text-sm font-semibold'>
                {t('Today usage')}
              </div>
              <div className='overflow-x-auto'>
                <table className='w-full min-w-[560px] text-xs'>
                  <thead>
                    <tr className='bg-muted/40 text-muted-foreground border-b text-[11px]'>
                      <th className='px-3 py-2 text-left font-medium'>
                        {t('Rule')}
                      </th>
                      <th className='px-3 py-2 text-left font-medium'>
                        {t('User')}
                      </th>
                      <th className='px-3 py-2 text-right font-medium'>
                        {t('Calls today')}
                      </th>
                      <th className='px-3 py-2 text-right font-medium'>
                        {t('Limit')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className='divide-y'>
                    {usage.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          className='text-muted-foreground px-3 py-6 text-center'
                        >
                          {t('No usage yet')}
                        </td>
                      </tr>
                    ) : (
                      usage.map((row, index) => (
                        <tr
                          key={`${row.rule_index}-${row.user_id}-${index}`}
                          className='hover:bg-muted/30'
                        >
                          <td className='text-muted-foreground px-3 py-1.5 font-mono'>
                            {row.rule_label}
                          </td>
                          <td className='px-3 py-1.5'>{row.username}</td>
                          <td
                            className={cn(
                              'px-3 py-1.5 text-right tabular-nums',
                              row.calls >= row.limit && 'text-destructive font-semibold'
                            )}
                          >
                            {row.calls.toLocaleString()}
                          </td>
                          <td className='text-muted-foreground px-3 py-1.5 text-right tabular-nums'>
                            {row.limit.toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

function RuleRow(props: {
  rule: UserLimitRule
  channels: { id: number; name: string; models: string[] }[]
  onChange: (patch: Partial<UserLimitRule>) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const channel = props.channels.find((item) => item.id === props.rule.channel_id)
  const models = channel?.models ?? []

  return (
    <div className='flex flex-wrap items-center gap-2 rounded-lg border p-2'>
      <select
        value={props.rule.channel_id || ''}
        onChange={(event) => {
          const nextId = Number(event.target.value)
          const nextChannel = props.channels.find((item) => item.id === nextId)
          props.onChange({
            channel_id: nextId,
            model: nextChannel?.models[0] ?? '',
          })
        }}
        className={selectClass}
      >
        <option value=''>{t('Select channel')}</option>
        {props.channels.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name} #{item.id}
          </option>
        ))}
      </select>

      <select
        value={props.rule.model}
        onChange={(event) => props.onChange({ model: event.target.value })}
        className={cn(selectClass, 'max-w-[320px]')}
      >
        <option value=''>{t('Whole channel')}</option>
        {models.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>

      <Input
        value={String(props.rule.daily_calls)}
        onChange={(event) =>
          props.onChange({ daily_calls: Number(event.target.value) || 0 })
        }
        inputMode='numeric'
        className='h-8 w-24 text-center'
      />
      <span className='text-muted-foreground text-[11px]'>{t('calls per day')}</span>

      <Button
        size='icon'
        variant='ghost'
        className='text-destructive ms-auto size-8'
        aria-label={t('Remove')}
        onClick={props.onRemove}
      >
        <Trash2 className='size-3.5' />
      </Button>
    </div>
  )
}
