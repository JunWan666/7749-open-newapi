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

import { type AnomalyUserRow, getUserAnomalies, updateAnomalyUserStatus } from './api'

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
        <span className='text-muted-foreground text-[11px]'>
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
          <RefreshCw className={cn('mr-1.5 size-4', isFetching && 'animate-spin')} />
          {t('Refresh')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='flex max-w-5xl flex-col gap-6'>
          <p className='text-muted-foreground text-sm'>
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
              <p className='text-muted-foreground rounded-md border border-dashed px-3 py-6 text-center text-xs'>
                {t('Nothing suspicious found')}
              </p>
            ) : (
              <div className='flex flex-col gap-3'>
                {payload.ip_groups.map((group) => (
                  <div
                    key={group.ip}
                    className={cn(
                      'overflow-hidden rounded-lg border',
                      group.accounts >= 3
                        ? 'border-destructive/40'
                        : 'border-warning/40'
                    )}
                  >
                    <div
                      className={cn(
                        'flex flex-wrap items-center gap-2 px-3 py-2 text-xs',
                        group.accounts >= 3
                          ? 'bg-destructive/10'
                          : 'bg-warning/10'
                      )}
                    >
                      {group.accounts >= 3 ? (
                        <AlertTriangle className='text-destructive size-3.5' />
                      ) : (
                        <AlertTriangle className='text-warning size-3.5' />
                      )}
                      <span className='font-mono font-medium'>{group.ip}</span>
                      <span className='text-muted-foreground'>
                        {group.accounts} {t('accounts')}
                      </span>
                    </div>
                    <div className='divide-y'>
                      {group.users.map((user) => (
                        <div
                          key={user.id}
                          className='flex flex-wrap items-center gap-3 px-3 py-2 text-xs'
                        >
                          <span className='font-mono text-muted-foreground w-12'>
                            #{user.id}
                          </span>
                          <span className='min-w-[100px] font-medium'>
                            {user.username}
                          </span>
                          {user.role >= 10 && (
                            <StatusBadge
                              label={t('Admin')}
                              variant='info'
                              copyable={false}
                            />
                          )}
                          {user.remark && (
                            <span className='text-success font-medium'>
                              {user.remark}
                            </span>
                          )}
                          <span className='text-muted-foreground font-mono'>
                            {user.register_ip || user.last_login_ip || '-'}
                          </span>
                          <span className='text-muted-foreground'>
                            {t('Registered')}:{' '}
                            {formatTimestamp(user.created_at)}
                          </span>
                          <span className='text-muted-foreground'>
                            {t('Calls')}: {user.request_count}
                          </span>
                          <span className='ml-auto'>
                            {actionButtons(user)}
                          </span>
                        </div>
                      ))}
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
              <p className='text-muted-foreground rounded-md border border-dashed px-3 py-6 text-center text-xs'>
                {t('Nothing suspicious found')}
              </p>
            ) : (
              <div className='divide-y rounded-lg border'>
                {payload.idle_users.map((user) => (
                  <div
                    key={user.id}
                    className='flex flex-wrap items-center gap-3 px-3 py-2 text-xs'
                  >
                    <span className='font-mono text-muted-foreground w-12'>
                      #{user.id}
                    </span>
                    <span className='min-w-[100px] font-medium'>
                      {user.username}
                    </span>
                    {user.role >= 10 && (
                      <StatusBadge
                        label={t('Admin')}
                        variant='info'
                        copyable={false}
                      />
                    )}
                    {user.remark && (
                      <span className='text-success font-medium'>
                        {user.remark}
                      </span>
                    )}
                    <span className='text-muted-foreground'>
                      {t('Check-ins')}: {user.checkin_days}
                    </span>
                    <span className='text-muted-foreground'>
                      {t('Registered')}: {formatTimestamp(user.created_at)}
                    </span>
                    <span className='ml-auto'>{actionButtons(user)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
