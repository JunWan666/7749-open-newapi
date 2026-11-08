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
import { AlertTriangle, Ban, CheckCircle2, RefreshCw, Users } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { formatTimestamp } from '@/lib/format'
import { cn } from '@/lib/utils'

import {
  type AnomalyUserRow,
  getUserAnomalies,
  updateAnomalyUserStatus,
} from './api'

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
  total_groups: number
  total_idle: number
}

const STATUS_SUSPICIOUS = 4
const STATUS_ENABLED = 1

function formatTokens(value: number): string {
  if (!value) {
    return '0'
  }
  if (value >= 100000000) {
    return `${(value / 100000000).toFixed(1)} 亿`
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

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['user-anomalies'],
    queryFn: getUserAnomalies,
  })

  const payload: AnomalyData = data?.data ?? {
    ip_groups: [],
    idle_users: [],
    total_groups: 0,
    total_idle: 0,
  }

  async function mark(id: number, status: number) {
    setBusyId(id)
    try {
      const res = await updateAnomalyUserStatus(id, status)
      if (res?.success) {
        toast.success(t('Status updated'))
        void queryClient.invalidateQueries({ queryKey: ['user-anomalies'] })
        void queryClient.invalidateQueries({ queryKey: ['users'] })
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
    if (user.status === STATUS_SUSPICIOUS) {
      return (
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
      )
    }
    if (user.status !== STATUS_ENABLED) {
      return null
    }
    return (
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
    )
  }

  /** 用户单元格：用户名 + 管理员徽章 */
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

  /** 备注单元格：绿色，空则显示占位 */
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
        <div className='flex flex-col gap-6'>
          <p className='text-muted-foreground max-w-4xl text-sm'>
            {t(
              'Accounts sharing one IP, and accounts that only check in without ever calling a model. Shared IPs can be normal (school / office NAT), so review before acting.'
            )}
          </p>

          {/* 同 IP 多账号 */}
          <section className='flex flex-col gap-3'>
            <div className='flex items-center gap-2'>
              <Users className='size-4' />
              <h3 className='text-sm font-semibold'>
                {t('Same IP, multiple accounts')}
              </h3>
              <StatusBadge
                label={String(payload.total_groups)}
                variant={payload.total_groups > 0 ? 'warning' : 'neutral'}
                copyable={false}
              />
            </div>

            {payload.ip_groups.length === 0 ? (
              <p className='text-muted-foreground rounded-lg border border-dashed px-3 py-8 text-center text-xs'>
                {t('Nothing suspicious found')}
              </p>
            ) : (
              <div className='flex flex-col gap-4'>
                {payload.ip_groups.map((group) => (
                  <div
                    key={group.ip}
                    className={cn(
                      'bg-card overflow-hidden rounded-xl border shadow-sm',
                      group.accounts >= 3
                        ? 'border-destructive/40'
                        : 'border-warning/40'
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
                          group.accounts >= 3
                            ? 'text-destructive'
                            : 'text-warning'
                        )}
                      />
                      <span className='font-mono text-sm font-semibold'>
                        {group.ip}
                      </span>
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
                            <th className={cn(thClass, 'text-right')}>
                              {t('Calls')}
                            </th>
                            <th className={cn(thClass, 'text-right')}>
                              {t('Tokens used')}
                            </th>
                            <th className={cn(thClass, 'text-right')}>
                              {t('Actions')}
                            </th>
                          </tr>
                        </thead>
                        <tbody className='divide-y'>
                          {group.users.map((user) => (
                            <tr key={user.id} className='hover:bg-muted/30'>
                              <td className={cn(tdClass, 'font-mono')}>
                                #{user.id}
                              </td>
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
            )}
          </section>

          {/* 只签到不调用 */}
          <section className='flex flex-col gap-3'>
            <div className='flex items-center gap-2'>
              <AlertTriangle className='size-4' />
              <h3 className='text-sm font-semibold'>
                {t('Check-in only, never called')}
              </h3>
              <StatusBadge
                label={String(payload.total_idle)}
                variant={payload.total_idle > 0 ? 'warning' : 'neutral'}
                copyable={false}
              />
            </div>

            {payload.idle_users.length === 0 ? (
              <p className='text-muted-foreground rounded-lg border border-dashed px-3 py-8 text-center text-xs'>
                {t('Nothing suspicious found')}
              </p>
            ) : (
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
                        <th className={cn(thClass, 'text-right')}>
                          {t('Check-ins')}
                        </th>
                        <th className={cn(thClass, 'text-right')}>
                          {t('Tokens used')}
                        </th>
                        <th className={cn(thClass, 'text-right')}>
                          {t('Actions')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className='divide-y'>
                      {payload.idle_users.map((user) => (
                        <tr key={user.id} className='hover:bg-muted/30'>
                          <td className={cn(tdClass, 'font-mono')}>
                            #{user.id}
                          </td>
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
            )}
          </section>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
