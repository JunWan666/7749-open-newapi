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
import { Pencil } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import { updateAnomalyNote } from './api'

interface HandleNoteCellProps {
  userId: number
  note?: string
}

/**
 * Inline editor for the "why did I handle this account" note.
 * Click to edit, blur or Enter to save, Esc to cancel.
 */
export function HandleNoteCell(props: HandleNoteCellProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(props.note ?? '')
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const skipSaveRef = useRef(false)

  async function save() {
    if (savingRef.current) {
      return
    }
    const next = value.trim()
    if (next === (props.note ?? '')) {
      setEditing(false)
      return
    }
    savingRef.current = true
    setSaving(true)
    try {
      const res = await updateAnomalyNote(props.userId, next)
      if (res?.success) {
        toast.success(t('Saved'))
        setEditing(false)
        void queryClient.invalidateQueries({ queryKey: ['user-anomalies'] })
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
        maxLength={500}
        value={value}
        disabled={saving}
        placeholder={t('Why was this account handled?')}
        className='h-7 w-[200px] text-xs'
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
            setValue(props.note ?? '')
            setEditing(false)
          }
        }}
      />
    )
  }

  return (
    <button
      type='button'
      title={props.note || t('Click to add a note')}
      className={cn(
        'hover:bg-muted group flex w-[200px] cursor-pointer items-center gap-1 rounded px-1.5 py-1 text-left text-xs transition-colors'
      )}
      onClick={() => {
        setValue(props.note ?? '')
        setEditing(true)
      }}
    >
      {props.note ? (
        <span className='text-foreground/80 truncate'>{props.note}</span>
      ) : (
        <span className='text-muted-foreground/50'>
          {t('Click to add a note')}
        </span>
      )}
      <Pencil className='text-muted-foreground/40 ml-auto size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100' />
    </button>
  )
}
