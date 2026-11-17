import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Save, Search, Trash2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
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

const USERS_PER_PAGE = 10

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
    queryFn: () => getUserLimitConfig(1, 100),
    staleTime: 0,
    refetchInterval: 60_000,
  })

  const config: UserLimitConfig | null = draft ?? data?.data?.config ?? null
  const channels = data?.data?.channels ?? []
  const usageRules = data?.data?.usage_rules ?? []
  const exemptDetail = data?.data?.exempt_users_detail ?? []
  const usageTotal = data?.data?.usage_total ?? 0
  const usageChannels = useMemo(() => {
    const map = new Map<number, string>()
    usageRules.forEach((group) => {
      if (!map.has(group.channel_id)) {
        map.set(group.channel_id, group.channel_name || `#${group.channel_id}`)
      }
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [usageRules])
  const [usageChannel, setUsageChannel] = useState<number | null>(null)
  const [rulePages, setRulePages] = useState<Record<number, number>>({})
  const currentChannelId = usageChannel ?? usageChannels[0]?.id ?? null
  const currentRules = usageRules.filter(
    (group) => group.channel_id === currentChannelId
  )

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
          <div className='grid w-full gap-4 xl:grid-cols-[minmax(0,400px)_minmax(0,1fr)]'>
            <div className='flex flex-col gap-4'>
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
                  config.exempt_users.map((id) => {
                    const name = exemptDetail.find((item) => item.id === id)
                      ?.username
                    return (
                      <span
                        key={id}
                        className='inline-flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-1 text-[11px]'
                      >
                        {name ? `${name} #${id}` : `#${id}`}
                        <button
                          type='button'
                          aria-label={t('Remove')}
                          onClick={() => removeExempt(id)}
                        >
                          <X className='size-3' />
                        </button>
                      </span>
                    )
                  })
                )}
              </div>
            </div>

            </div>

            <div className='flex flex-col gap-4'>
            <div className='bg-card flex flex-col overflow-hidden rounded-xl border shadow-sm'>
              <div className='flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2'>
                <div className='text-sm font-semibold'>{t('Today usage')}</div>
                <span className='text-muted-foreground text-[11px]'>
                  {usageTotal} {t('Rules')}
                </span>
              </div>

              <div className='bg-muted/40 flex flex-wrap items-center gap-1 border-b px-2 py-1.5'>
                {usageChannels.length === 0 ? (
                  <span className='text-muted-foreground px-2 text-[11px]'>
                    {t('No usage yet')}
                  </span>
                ) : (
                  usageChannels.map((channel) => (
                    <button
                      key={channel.id}
                      type='button'
                      onClick={() => setUsageChannel(channel.id)}
                      className={cn(
                        'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                        channel.id === currentChannelId
                          ? 'bg-background shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {channel.name}
                    </button>
                  ))
                )}
              </div>

              <div className='flex flex-col divide-y'>
                {currentRules.length === 0 ? (
                  <div className='text-muted-foreground px-6 py-8 text-center text-sm'>
                    {t('No usage yet')}
                  </div>
                ) : (
                  currentRules.map((group) => {
                    const page = rulePages[group.rule_index] ?? 1
                    const pages = Math.max(
                      1,
                      Math.ceil(group.users.length / USERS_PER_PAGE)
                    )
                    const visible = group.users.slice(
                      (page - 1) * USERS_PER_PAGE,
                      page * USERS_PER_PAGE
                    )
                    return (
                      <div
                        key={`rule-${group.rule_index}`}
                        className='flex flex-col gap-1.5 p-2.5'
                      >
                        <div className='flex flex-wrap items-center justify-between gap-2'>
                          <span className='font-mono text-xs font-semibold'>
                            {group.model || t('Whole channel')}
                          </span>
                          <span className='text-muted-foreground text-[11px]'>
                            {t('Limit')}: {group.limit.toLocaleString()} ·{' '}
                            {group.user_count} {t('users')}
                          </span>
                        </div>
                        <div className='overflow-x-auto rounded-lg border'>
                          <table className='w-full min-w-[400px] text-xs'>
                            <thead>
                              <tr className='bg-muted/40 text-muted-foreground border-b text-[11px]'>
                                <th className='w-12 px-3 py-1 text-left font-medium'>
                                  #
                                </th>
                                <th className='px-3 py-1 text-left font-medium'>
                                  {t('User')}
                                </th>
                                <th className='px-3 py-1 text-right font-medium'>
                                  {t('Calls today')}
                                </th>
                                <th className='px-3 py-1 text-right font-medium'>
                                  {t('Limit')}
                                </th>
                              </tr>
                            </thead>
                            <tbody className='divide-y'>
                              {visible.length === 0 ? (
                                <tr>
                                  <td
                                    colSpan={4}
                                    className='text-muted-foreground px-3 py-3 text-center'
                                  >
                                    {t('No usage yet')}
                                  </td>
                                </tr>
                              ) : (
                                visible.map((row, index) => (
                                  <tr
                                    key={`${group.rule_index}-${row.user_id}`}
                                    className='hover:bg-muted/30'
                                  >
                                    <td className='text-muted-foreground px-3 py-1 tabular-nums'>
                                      {(page - 1) * USERS_PER_PAGE + index + 1}
                                    </td>
                                    <td className='px-3 py-1'>{row.username}</td>
                                    <td
                                      className={cn(
                                        'px-3 py-1 text-right tabular-nums',
                                        row.calls >= row.limit &&
                                          'text-destructive font-semibold'
                                      )}
                                    >
                                      {row.calls.toLocaleString()}
                                    </td>
                                    <td className='text-muted-foreground px-3 py-1 text-right tabular-nums'>
                                      {row.limit.toLocaleString()}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>

                        {group.users.length > USERS_PER_PAGE && (
                          <div className='flex items-center justify-end gap-2'>
                            <span className='text-muted-foreground text-[11px]'>
                              {page}/{pages}
                            </span>
                            <div className='flex items-center gap-1'>
                              <Button
                                size='sm'
                                variant='outline'
                                className='h-6 px-2'
                                disabled={page <= 1}
                                onClick={() =>
                                  setRulePages((prev) => ({
                                    ...prev,
                                    [group.rule_index]: Math.max(1, page - 1),
                                  }))
                                }
                              >
                                {t('Prev page')}
                              </Button>
                              <Button
                                size='sm'
                                variant='outline'
                                className='h-6 px-2'
                                disabled={page >= pages}
                                onClick={() =>
                                  setRulePages((prev) => ({
                                    ...prev,
                                    [group.rule_index]: Math.min(pages, page + 1),
                                  }))
                                }
                              >
                                {t('Next page')}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
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