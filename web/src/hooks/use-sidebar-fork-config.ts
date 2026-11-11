import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'

export type SidebarForkLink = {
  name: string
  url: string
}

export type SidebarForkConfig = {
  group_title: string
  show_playground: boolean
  flat_chat_presets: boolean
  links: SidebarForkLink[]
}

export const DEFAULT_SIDEBAR_FORK_CONFIG: SidebarForkConfig = {
  group_title: '聊天和娱乐',
  show_playground: false,
  flat_chat_presets: true,
  links: [],
}

async function fetchSidebarForkConfig(): Promise<SidebarForkConfig> {
  const res = await api.get('/api/sidebar-config')
  const data = res.data?.data as SidebarForkConfig | undefined
  if (!data) {
    return DEFAULT_SIDEBAR_FORK_CONFIG
  }
  return {
    group_title: data.group_title || DEFAULT_SIDEBAR_FORK_CONFIG.group_title,
    show_playground: Boolean(data.show_playground),
    flat_chat_presets: data.flat_chat_presets !== false,
    links: Array.isArray(data.links) ? data.links : [],
  }
}

/**
 * Admin-editable layout of the "Chat & Fun" sidebar group
 * (group title, playground visibility, custom shortcuts).
 */
export function useSidebarForkConfig(): SidebarForkConfig {
  const query = useQuery({
    queryKey: ['sidebar-fork-config'],
    queryFn: fetchSidebarForkConfig,
    staleTime: 5 * 60 * 1000,
  })
  return query.data ?? DEFAULT_SIDEBAR_FORK_CONFIG
}
