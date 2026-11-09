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
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { getUserGroups } from '@/lib/api'

import { updateApiKey } from '../api'
import type { ApiKey } from '../types'
import {
  ApiKeyGroupCombobox,
  type ApiKeyGroupOption,
} from './api-key-group-combobox'

interface ApiKeyGroupEditableCellProps {
  apiKey: ApiKey
}

/**
 * Inline group switcher for the API key table: pick a group, it saves immediately.
 */
export function ApiKeyGroupEditableCell(props: ApiKeyGroupEditableCellProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [saving, setSaving] = useState(false)

  const { data: groupsData } = useQuery({
    queryKey: ['user-groups'],
    queryFn: getUserGroups,
    staleTime: 60_000,
  })

  const options = useMemo<ApiKeyGroupOption[]>(
    () =>
      Object.entries(groupsData?.data || {}).map(([key, info]) => ({
        value: key,
        label: key,
        desc: info.desc || key,
        ratio: info.ratio,
      })),
    [groupsData]
  )

  async function handleChange(nextGroup: string) {
    if (saving) {
      return
    }
    if (nextGroup === (props.apiKey.group || '')) {
      return
    }

    setSaving(true)
    try {
      const res = await updateApiKey({
        id: props.apiKey.id,
        name: props.apiKey.name,
        remain_quota: props.apiKey.remain_quota,
        expired_time: props.apiKey.expired_time,
        unlimited_quota: props.apiKey.unlimited_quota,
        model_limits_enabled: props.apiKey.model_limits_enabled,
        model_limits: props.apiKey.model_limits ?? '',
        allow_ips: props.apiKey.allow_ips ?? '',
        group: nextGroup,
        auto_groups: props.apiKey.auto_groups ?? [],
        cross_group_retry: props.apiKey.cross_group_retry ?? false,
      })
      if (res?.success) {
        toast.success(`${t('Saved')} · ${nextGroup}`)
        void queryClient.invalidateQueries({ queryKey: ['keys'] })
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
    <ApiKeyGroupCombobox
      options={options}
      value={props.apiKey.group || ''}
      onValueChange={(value: string) => {
        void handleChange(value)
      }}
      disabled={saving}
      compact
    />
  )
}
