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
import {
  Activity,
  Box,
  CreditCard,
  FileText,
  FlaskConical,
  Gamepad2,
  Key,
  LayoutDashboard,
  ListTodo,
  ListTree,
  MessageSquare,
  QrCode,
  Radio,
  MessageSquareText,
  ServerCog,
  ShieldAlert,
  ShieldCheck,
  Settings,
  Ticket,
  User,
  Users,
  Wallet,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import type {
  NavGroup,
  NavItem,
  SidebarData,
} from '@/components/layout/types'
import { useSidebarForkConfig } from '@/hooks/use-sidebar-fork-config'
import { ROLE } from '@/lib/roles'

/**
 * Root navigation groups for the application sidebar.
 *
 * These are shown when the URL does not match any nested sidebar view
 * registered in `layout/lib/sidebar-view-registry.ts`.
 */
export function useSidebarData(): SidebarData {
  const { t } = useTranslation()
  const forkSidebar = useSidebarForkConfig()

  // Admin-defined groups (chat presets like AI 生图 keep their {key} auto-fill).
  const forkGroups: NavGroup[] = []
  forkSidebar.groups.forEach((group, index) => {
    const items: NavItem[] = []
    if (group.show_playground) {
      items.push({
        title: t('Playground'),
        url: '/playground',
        icon: FlaskConical,
      })
    }
    if (group.show_chat_presets) {
      items.push({
        title: t('Chat'),
        icon: MessageSquare,
        type: 'chat-presets',
        flat: group.flat_chat_presets,
      })
    }
    for (const link of group.links) {
      items.push({
        title: link.name,
        url: link.url,
        icon: Gamepad2,
        external: !link.embed,
        embed: Boolean(link.embed),
      })
    }
    if (items.length === 0) {
      return
    }
    forkGroups.push({
      id: `fork-group-${index}`,
      title: group.title,
      items,
    })
  })

  return {
    navGroups: [
      ...forkGroups,
      {
        id: 'general',
        title: t('General'),
        items: [
          {
            title: t('Overview'),
            url: '/dashboard/overview',
            icon: Activity,
          },
          {
            title: t('Dashboard'),
            url: '/dashboard/models',
            icon: LayoutDashboard,
          },
          {
            title: t('API Keys'),
            url: '/keys',
            icon: Key,
          },
          {
            title: t('Usage Logs'),
            url: '/usage-logs/common',
            icon: FileText,
          },
          {
            title: t('Task Logs'),
            url: '/usage-logs/task',
            activeUrls: ['/usage-logs/drawing'],
            configUrls: ['/usage-logs/drawing', '/usage-logs/task'],
            icon: ListTodo,
          },
        ],
      },
      {
        id: 'personal',
        title: t('Personal'),
        items: [
          {
            title: t('Wallet'),
            url: '/wallet',
            icon: Wallet,
          },
          {
            title: t('Profile'),
            url: '/profile',
            icon: User,
          },
        ],
      },
      {
        id: 'admin',
        title: t('Admin'),
        items: [
          {
            title: t('Channels'),
            url: '/channels',
            icon: Radio,
          },
          {
            title: t('Models'),
            url: '/models/metadata',
            icon: Box,
          },
          {
            title: t('Users'),
            url: '/users',
            icon: Users,
          },
          {
            title: t('Redemption Codes'),
            url: '/redemption-codes',
            icon: Ticket,
          },
          {
            title: t('Anomaly Users'),
            url: '/user-anomalies',
            icon: ShieldAlert,
          },
          {
            title: t('Notice Copy'),
            url: '/notice-config',
            icon: MessageSquareText,
          },
          {
            title: t('WeChat Group QR Code'),
            url: '/group-qrcode',
            icon: QrCode,
          },
          {
            title: t('Sidebar Menu'),
            url: '/sidebar-config',
            icon: ListTree,
          },
          {
            title: t('Key Quota Guard'),
            url: '/key-quota',
            icon: ShieldCheck,
          },
          {
            title: t('Subscriptions'),
            url: '/subscriptions',
            icon: CreditCard,
          },
          {
            title: t('System Info'),
            url: '/system-info',
            icon: ServerCog,
            requiredRole: ROLE.SUPER_ADMIN,
          },
          {
            title: t('System Settings'),
            url: '/system-settings/site',
            activeUrls: ['/system-settings'],
            icon: Settings,
          },
        ],
      },
    ],
  }
}
