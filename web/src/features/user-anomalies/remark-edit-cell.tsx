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
import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Input } from '@/components/ui/input'

import { updateAnomalyUserRemark } from './api'

interface RemarkEditCellProps {
  userId: number
  remark?: string
}

/**
 * Inline editor for the user remark (users.remark), so an admin can note
 * "joined the group, released" right here before restoring the account.
 */
export function RemarkEditCell(props: RemarkEditCellProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(props.remark ?? '')
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const skipSaveRef = useRef(false)

  async function save() {
    if (savingRef.current) {
      return
    }
    const next = value.trim()
    if (next === (props.remark ?? '')) {
      setEditing(false)
      return
    }
    savingRef.current = true
    setSaving(true)
    try {
      const res = await updateAnomalyUserRemark(props.userId, next)
      if (res?.success) {
        toast.success(t('Saved'))
        setEditing(false)
        void queryClient.invalidateQueries({ queryKey: ['user-anomalies'] })
        void queryClient.invalidateQueries({ queryKey: ['users'] })
      } else {
        toast.error(res?.message || t('Save failed'))
      }
    } catch {
      toast.error(t('Save failed'))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <Input
        autoFocus
        maxLength={255}
        value={value}
        disabled={saving}
        placeholder={t('Remark')}
        className='h-7 w-[130px] text-xs'
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => {
          if (skipSaveRef.current) {
            skipSaveRef.current = false
            return
          }
          void save()
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            event.currentTarget.blur()
          } else if (event.key === 'Escape') {
            skipSaveRef.current = true
            setValue(props.remark ?? '')
            setEditing(false)
          }
        }}
      />
    )
  }

  return (
    <button
      type='button'
      title={props.remark || t('Click to add a remark')}
      className='hover:bg-muted w-[130px] cursor-pointer truncate rounded px-1.5 py-1 text-left text-xs transition-colors'
      onClick={() => {
        setValue(props.remark ?? '')
        setEditing(true)
      }}
    >
      {props.remark ? (
        <span className='text-success font-medium'>{props.remark}</span>
      ) : (
        <span className='text-muted-foreground/50'>{t('Remark')}</span>
      )}
    </button>
  )
}
