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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  EyeOff,
  Eye,
  RefreshCw,
  Users,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatTimestamp } from '@/lib/format'
import { cn } from '@/lib/utils'

import {
  type AnomalyUserRow,
  type IgnoredAnomalyUser,
  getUserAnomalies,
  ignoreAnomalyUser,
  unignoreAnomalyUser,
  updateAnomalyUserStatus,
} from './api'
import { HandleNoteCell } from './handle-note-cell'

type AnomalyUser = AnomalyUserRow

type AnomalyIPGroup = {
  ip: string
  accounts: number
  users: AnomalyUser[]
}

type IdleCheckinUser = AnomalyUser & { checkin_days: number }

type AnomalyData = {
  ip_groups: AnomalyIPGroup[]
  idle_users: IdleCheckinUser[]
  handled_users: AnomalyUser[]
  ignored_users: IgnoredAnomalyUser[]
  total_groups: number
  total_idle: number
  total_handled: number
  total_ignored: number
}

const STATUS_SUSPICIOUS = 4
const STATUS_ENABLED = 1
type AnomalyTab = 'ip' | 'idle' | 'handled' | 'ignored'

function formatTokens(value: number): string {
  if (!value) {
    return '0'
  }
  if (value >= 100000000) {
    return `${(value / 100000000).toFixed(2)} 亿`
  }
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)} 万`
  }
  return String(value)
}

export function UserAnomalies() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [busyId, setBusyId] = useState<number | null>(null)
  const [tab, setTab] = useState<AnomalyTab>('ip')

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['user-anomalies'],
    queryFn: getUserAnomalies,
  })

  const payload: AnomalyData = data?.data ?? {
    ip_groups: [],
    idle_users: [],
    handled_users: [],
    ignored_users: [],
    total_groups: 0,
    total_idle: 0,
    total_handled: 0,
    total_ignored: 0,
  }

  async function refreshAll() {
    void queryClient.invalidateQueries({ queryKey: ['user-anomalies'] })
    void queryClient.invalidateQueries({ queryKey: ['users'] })
  }

  async function mark(id: number, status: number) {
    setBusyId(id)
    try {
      const res = await updateAnomalyUserStatus(id, status)
      if (res?.success) {
        toast.success(t('Status updated'))
        await refreshAll()
      } else {
        toast.error(res?.message || t('Save failed'))
      }
    } catch {
      toast.error(t('Save failed'))
    } finally {
      setBusyId(null)
    }
  }

  async function ignore(id: number) {
    setBusyId(id)
    try {
      const res = await ignoreAnomalyUser(id)
      if (res?.success) {
        toast.success(t('Added to ignore list'))
        await refreshAll()
      } else {
        toast.error(res?.message || t('Save failed'))
      }
    } catch {
      toast.error(t('Save failed'))
    } finally {
      setBusyId(null)
    }
  }

  async function unignore(id: number) {
    setBusyId(id)
    try {
      const res = await unignoreAnomalyUser(id)
      if (res?.success) {
        toast.success(t('Removed from ignore list'))
        await refreshAll()
      } else {
        toast.error(res?.message || t('Save failed'))
      }
    } catch {
      toast.error(t('Save failed'))
    } finally {
      setBusyId(null)
    }
  }

  function actionButtons(user: AnomalyUser) {
    if (user.role >= 10) {
      return (
        <span className='text-muted-foreground whitespace-nowrap text-[11px]'>
          {t('Admin account')}
        </span>
      )
    }
    const suspicious = user.status === STATUS_SUSPICIOUS
    return (
      <div className='flex items-center justify-end gap-1'>
        {suspicious && (
          <Button
            size='sm'
            variant='outline'
            disabled={busyId === user.id}
            onClick={() => {
              void mark(user.id, STATUS_ENABLED)
            }}
          >
            <CheckCircle2 className='mr-1 size-3.5' />
            {t('Restore')}
          </Button>
        )}
        {!suspicious && user.status === STATUS_ENABLED && (
          <Button
            size='sm'
            variant='destructive'
            disabled={busyId === user.id}
            onClick={() => {
              void mark(user.id, STATUS_SUSPICIOUS)
            }}
          >
            <Ban className='mr-1 size-3.5' />
            {t('Mark suspicious')}
          </Button>
        )}
        <Button
          size='sm'
          variant='ghost'
          disabled={busyId === user.id}
          title={t('Ignore this account')}
          onClick={() => {
            void ignore(user.id)
          }}
        >
          <EyeOff className='mr-1 size-3.5' />
          {t('Ignore')}
        </Button>
      </div>
    )
  }

  function userCell(user: AnomalyUser) {
    return (
      <div className='flex items-center gap-1.5'>
        <span className='font-medium'>{user.username}</span>
        {user.role >= 10 && (
          <StatusBadge label={t('Admin')} variant='info' copyable={false} />
        )}
      </div>
    )
  }

  function remarkCell(user: AnomalyUser) {
    if (!user.remark) {
      return <span className='text-muted-foreground/40'>-</span>
    }
    return (
      <span className='text-success max-w-[120px] truncate font-medium'>
        {user.remark}
      </span>
    )
  }

  const thClass =
    'text-muted-foreground px-3 py-2 text-left text-[11px] font-medium whitespace-nowrap'
  const tdClass = 'px-3 py-2 align-middle'

  function renderIpTab(): ReactNode {
    if (payload.ip_groups.length === 0) {
      return (
        <p className='text-muted-foreground rounded-lg border border-dashed px-3 py-12 text-center text-xs'>
          {t('Nothing suspicious found')}
        </p>
      )
    }
    return (
      <div className='flex flex-col gap-4'>
        {payload.ip_groups.map((group) => (
          <div
            key={group.ip}
            className={cn(
              'bg-card overflow-hidden rounded-xl border shadow-sm',
              group.accounts >= 3 ? 'border-destructive/40' : 'border-warning/40'
            )}
          >
            <div
              className={cn(
                'flex flex-wrap items-center gap-2 border-b px-3 py-2',
                group.accounts >= 3
                  ? 'border-destructive/30 bg-destructive/10'
                  : 'border-warning/30 bg-warning/10'
              )}
            >
              <AlertTriangle
                className={cn(
                  'size-4',
                  group.accounts >= 3 ? 'text-destructive' : 'text-warning'
                )}
              />
              <span className='font-mono text-sm font-semibold'>{group.ip}</span>
              <StatusBadge
                label={`${group.accounts} ${t('accounts')}`}
                variant={group.accounts >= 3 ? 'danger' : 'warning'}
                copyable={false}
              />
            </div>
            <div className='overflow-x-auto'>
              <table className='w-full min-w-[880px] text-xs'>
                <thead>
                  <tr className='bg-muted/40 border-b'>
                    <th className={cn(thClass, 'w-16')}>{t('ID')}</th>
                    <th className={thClass}>{t('Username')}</th>
                    <th className={thClass}>{t('Remark')}</th>
                    <th className={thClass}>{t('IP')}</th>
                    <th className={thClass}>{t('Created At')}</th>
                    <th className={cn(thClass, 'text-right')}>{t('Calls')}</th>
                    <th className={cn(thClass, 'text-right')}>
                      {t('Tokens used')}
                    </th>
                    <th className={cn(thClass, 'text-right')}>{t('Actions')}</th>
                  </tr>
                </thead>
                <tbody className='divide-y'>
                  {group.users.map((user) => (
                    <tr key={user.id} className='hover:bg-muted/30'>
                      <td className={cn(tdClass, 'font-mono')}>#{user.id}</td>
                      <td className={tdClass}>{userCell(user)}</td>
                      <td className={tdClass}>{remarkCell(user)}</td>
                      <td
                        className={cn(
                          tdClass,
                          'text-muted-foreground font-mono whitespace-nowrap'
                        )}
                      >
                        {user.register_ip || user.last_login_ip || '-'}
                      </td>
                      <td
                        className={cn(
                          tdClass,
                          'text-muted-foreground whitespace-nowrap'
                        )}
                      >
                        {formatTimestamp(user.created_at)}
                      </td>
                      <td className={cn(tdClass, 'text-right')}>
                        {user.request_count.toLocaleString()}
                      </td>
                      <td className={cn(tdClass, 'text-right')}>
                        {formatTokens(user.total_tokens)}
                      </td>
                      <td className={cn(tdClass, 'text-right')}>
                        {actionButtons(user)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    )
  }

  function renderIdleTab(): ReactNode {
    if (payload.idle_users.length === 0) {
      return (
        <p className='text-muted-foreground rounded-lg border border-dashed px-3 py-12 text-center text-xs'>
          {t('Nothing suspicious found')}
        </p>
      )
    }
    return (
      <div className='bg-card overflow-hidden rounded-xl border shadow-sm'>
        <div className='overflow-x-auto'>
          <table className='w-full min-w-[820px] text-xs'>
            <thead>
              <tr className='bg-muted/40 border-b'>
                <th className={cn(thClass, 'w-16')}>{t('ID')}</th>
                <th className={thClass}>{t('Username')}</th>
                <th className={thClass}>{t('Remark')}</th>
                <th className={thClass}>{t('IP')}</th>
                <th className={thClass}>{t('Created At')}</th>
                <th className={cn(thClass, 'text-right')}>{t('Check-ins')}</th>
                <th className={cn(thClass, 'text-right')}>
                  {t('Tokens used')}
                </th>
                <th className={cn(thClass, 'text-right')}>{t('Actions')}</th>
              </tr>
            </thead>
            <tbody className='divide-y'>
              {payload.idle_users.map((user) => (
                <tr key={user.id} className='hover:bg-muted/30'>
                  <td className={cn(tdClass, 'font-mono')}>#{user.id}</td>
                  <td className={tdClass}>{userCell(user)}</td>
                  <td className={tdClass}>{remarkCell(user)}</td>
                  <td
                    className={cn(
                      tdClass,
                      'text-muted-foreground font-mono whitespace-nowrap'
                    )}
                  >
                    {user.register_ip || user.last_login_ip || '-'}
                  </td>
                  <td
                    className={cn(
                      tdClass,
                      'text-muted-foreground whitespace-nowrap'
                    )}
                  >
                    {formatTimestamp(user.created_at)}
                  </td>
                  <td className={cn(tdClass, 'text-right')}>
                    {user.checkin_days}
                  </td>
                  <td className={cn(tdClass, 'text-right')}>
                    {formatTokens(user.total_tokens)}
                  </td>
                  <td className={cn(tdClass, 'text-right')}>
                    {actionButtons(user)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  function renderHandledTab(): ReactNode {
    if (payload.handled_users.length === 0) {
      return (
        <p className='text-muted-foreground rounded-lg border border-dashed px-3 py-12 text-center text-xs'>
          {t('No handled accounts yet')}
        </p>
      )
    }
    return (
      <div className='bg-card overflow-hidden rounded-xl border shadow-sm'>
        <div className='overflow-x-auto'>
          <table className='w-full min-w-[1060px] text-xs'>
            <thead>
              <tr className='bg-muted/40 border-b'>
                <th className={cn(thClass, 'w-16')}>{t('ID')}</th>
                <th className={thClass}>{t('Username')}</th>
                <th className={thClass}>{t('Remark')}</th>
                <th className={thClass}>{t('Status')}</th>
                <th className={thClass}>{t('Handle note')}</th>
                <th className={thClass}>{t('IP')}</th>
                <th className={cn(thClass, 'text-right')}>{t('Calls')}</th>
                <th className={cn(thClass, 'text-right')}>{t('Tokens used')}</th>
                <th className={cn(thClass, 'text-right')}>{t('Actions')}</th>
              </tr>
            </thead>
            <tbody className='divide-y'>
              {payload.handled_users.map((user) => (
                <tr key={user.id} className='hover:bg-muted/30'>
                  <td className={cn(tdClass, 'font-mono')}>#{user.id}</td>
                  <td className={tdClass}>{userCell(user)}</td>
                  <td className={tdClass}>{remarkCell(user)}</td>
                  <td className={tdClass}>
                    <StatusBadge
                      label={
                        user.status === STATUS_SUSPICIOUS
                          ? t('Suspicious')
                          : t('Disabled')
                      }
                      variant={
                        user.status === STATUS_SUSPICIOUS ? 'warning' : 'neutral'
                      }
                      copyable={false}
                    />
                  </td>
                  <td className={tdClass}>
                    <HandleNoteCell
                      userId={user.id}
                      note={user.handle_note}
                    />
                  </td>
                  <td
                    className={cn(
                      tdClass,
                      'text-muted-foreground font-mono whitespace-nowrap'
                    )}
                  >
                    {user.register_ip || user.last_login_ip || '-'}
                  </td>
                  <td className={cn(tdClass, 'text-right')}>
                    {user.request_count.toLocaleString()}
                  </td>
                  <td className={cn(tdClass, 'text-right')}>
                    {formatTokens(user.total_tokens)}
                  </td>
                  <td className={cn(tdClass, 'text-right')}>
                    <Button
                      size='sm'
                      variant='outline'
                      disabled={busyId === user.id}
                      onClick={() => {
                        void mark(user.id, STATUS_ENABLED)
                      }}
                    >
                      <CheckCircle2 className='mr-1 size-3.5' />
                      {t('Restore')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  function renderIgnoredTab(): ReactNode {
    if (payload.ignored_users.length === 0) {
      return (
        <p className='text-muted-foreground rounded-lg border border-dashed px-3 py-12 text-center text-xs'>
          {t('No ignored accounts yet')}
        </p>
      )
    }
    return (
      <div className='bg-card overflow-hidden rounded-xl border shadow-sm'>
        <div className='overflow-x-auto'>
          <table className='w-full min-w-[860px] text-xs'>
            <thead>
              <tr className='bg-muted/40 border-b'>
                <th className={cn(thClass, 'w-16')}>{t('ID')}</th>
                <th className={thClass}>{t('Username')}</th>
                <th className={thClass}>{t('Remark')}</th>
                <th className={thClass}>{t('IP')}</th>
                <th className={cn(thClass, 'text-right')}>{t('Calls')}</th>
                <th className={cn(thClass, 'text-right')}>{t('Tokens used')}</th>
                <th className={thClass}>{t('Ignored at')}</th>
                <th className={cn(thClass, 'text-right')}>{t('Actions')}</th>
              </tr>
            </thead>
            <tbody className='divide-y'>
              {payload.ignored_users.map((user) => (
                <tr key={user.id} className='hover:bg-muted/30'>
                  <td className={cn(tdClass, 'font-mono')}>#{user.id}</td>
                  <td className={tdClass}>{userCell(user)}</td>
                  <td className={tdClass}>{remarkCell(user)}</td>
                  <td
                    className={cn(
                      tdClass,
                      'text-muted-foreground font-mono whitespace-nowrap'
                    )}
                  >
                    {user.register_ip || user.last_login_ip || '-'}
                  </td>
                  <td className={cn(tdClass, 'text-right')}>
                    {user.request_count.toLocaleString()}
                  </td>
                  <td className={cn(tdClass, 'text-right')}>
                    {formatTokens(user.total_tokens)}
                  </td>
                  <td
                    className={cn(
                      tdClass,
                      'text-muted-foreground whitespace-nowrap'
                    )}
                  >
                    {formatTimestamp(user.ignored_at)}
                  </td>
                  <td className={cn(tdClass, 'text-right')}>
                    <Button
                      size='sm'
                      variant='outline'
                      disabled={busyId === user.id}
                      onClick={() => {
                        void unignore(user.id)
                      }}
                    >
                      <Eye className='mr-1 size-3.5' />
                      {t('Unignore')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Anomaly Users')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Button
          variant='outline'
          size='sm'
          disabled={isFetching}
          onClick={() => {
            void refetch()
          }}
        >
          <RefreshCw
            className={cn('mr-1.5 size-4', isFetching && 'animate-spin')}
          />
          {t('Refresh')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='flex flex-col gap-5'>
          <p className='text-muted-foreground max-w-4xl text-sm'>
            {t(
              'Accounts sharing one IP, and accounts that only check in without ever calling a model. Shared IPs can be normal (school / office NAT), so review before acting.'
            )}
          </p>

          <Tabs
            value={tab}
            onValueChange={(value) => setTab(value as AnomalyTab)}
          >
            <TabsList className='grid w-full max-w-2xl grid-cols-4'>
              <TabsTrigger value='ip' className='gap-1.5'>
                <Users className='size-3.5' />
                {t('Same IP')}
                <TabCount value={payload.total_groups} />
              </TabsTrigger>
              <TabsTrigger value='idle' className='gap-1.5'>
                <AlertTriangle className='size-3.5' />
                {t('Check-in only')}
                <TabCount value={payload.total_idle} />
              </TabsTrigger>
              <TabsTrigger value='handled' className='gap-1.5'>
                <Ban className='size-3.5' />
                {t('Handled')}
                <TabCount value={payload.total_handled} />
              </TabsTrigger>
              <TabsTrigger value='ignored' className='gap-1.5'>
                <EyeOff className='size-3.5' />
                {t('Ignored')}
                <TabCount value={payload.total_ignored} />
              </TabsTrigger>
            </TabsList>

            <TabsContent value='ip' className='mt-5'>
              {renderIpTab()}
            </TabsContent>
            <TabsContent value='idle' className='mt-5'>
              {renderIdleTab()}
            </TabsContent>
            <TabsContent value='handled' className='mt-5'>
              {renderHandledTab()}
            </TabsContent>
            <TabsContent value='ignored' className='mt-5'>
              {renderIgnoredTab()}
            </TabsContent>
          </Tabs>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

function TabCount(props: { value: number }) {
  if (!props.value) {
    return null
  }
  return (
    <span className='bg-muted text-muted-foreground rounded-full px-1.5 text-[10px] leading-4 tabular-nums'>
      {props.value}
    </span>
  )
}
