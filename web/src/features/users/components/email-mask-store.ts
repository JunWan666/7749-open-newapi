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
import { useSyncExternalStore } from 'react'

type EmailMaskState = {
  /** Whether every row is masked by default. */
  masked: boolean
  /** Per-row overrides; takes precedence over the global flag. */
  overrides: Record<number, boolean>
}

let state: EmailMaskState = { masked: false, overrides: {} }
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): EmailMaskState {
  return state
}

export type EmailMask = {
  masked: boolean
  isRowMasked: (userId: number) => boolean
  toggleAll: () => void
  toggleRow: (userId: number) => void
}

/**
 * Module level store (no provider needed) so the table header and every email cell
 * can share one mask state. Used before taking screenshots of the user list.
 */
export function useEmailMask(): EmailMask {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  return {
    masked: snapshot.masked,
    isRowMasked: (userId: number) => snapshot.overrides[userId] ?? snapshot.masked,
    toggleAll: () => {
      state = { masked: !state.masked, overrides: {} }
      emit()
    },
    toggleRow: (userId: number) => {
      const current = state.overrides[userId] ?? state.masked
      state = {
        ...state,
        overrides: { ...state.overrides, [userId]: !current },
      }
      emit()
    },
  }
}
