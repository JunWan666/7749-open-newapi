import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'

export type SidebarForkLink = {
  name: string
  url: string
  /** Open inside the console (iframe) instead of a new tab. */
  embed?: boolean
}

export type SidebarForkGroup = {
  title: string
  show_playground: boolean
  show_chat_presets: boolean
  flat_chat_presets: boolean
  links: SidebarForkLink[]
}

export type SidebarForkConfig = {
  groups: SidebarForkGroup[]
}

export const DEFAULT_SIDEBAR_FORK_CONFIG: SidebarForkConfig = {
  groups: [
    {
      title: '生图和聊天',
      show_playground: false,
      show_chat_presets: true,
      flat_chat_presets: true,
      links: [],
    },
    {
      title: '娱乐',
      show_playground: false,
      show_chat_presets: false,
      flat_chat_presets: false,
      links: [],
    },
  ],
}

function normalizeGroup(group: SidebarForkGroup): SidebarForkGroup {
  return {
    title: group.title || '自定义分组',
    show_playground: Boolean(group.show_playground),
    show_chat_presets: Boolean(group.show_chat_presets),
    flat_chat_presets: Boolean(group.flat_chat_presets),
    links: Array.isArray(group.links) ? group.links : [],
  }
}

async function fetchSidebarForkConfig(): Promise<SidebarForkConfig> {
  const res = await api.get('/api/sidebar-config')
  const data = res.data?.data as SidebarForkConfig | undefined
  if (!data || !Array.isArray(data.groups) || data.groups.length === 0) {
    return DEFAULT_SIDEBAR_FORK_CONFIG
  }
  return { groups: data.groups.map(normalizeGroup) }
}

/**
 * Admin-editable layout of the custom sidebar groups
 * (group titles, playground/chat entries, and custom shortcuts).
 */
export function useSidebarForkConfig(): SidebarForkConfig {
  const query = useQuery({
    queryKey: ['sidebar-fork-config'],
    queryFn: fetchSidebarForkConfig,
    staleTime: 5 * 60 * 1000,
  })
  return query.data ?? DEFAULT_SIDEBAR_FORK_CONFIG
}
