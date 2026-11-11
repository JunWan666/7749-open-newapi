import { api } from '@/lib/api'

export type SidebarLinkData = {
  name: string
  url: string
}

export type SidebarConfigData = {
  group_title: string
  show_playground: boolean
  flat_chat_presets: boolean
  links: SidebarLinkData[]
}

export async function getSidebarConfig(): Promise<{
  success: boolean
  data?: SidebarConfigData
}> {
  const res = await api.get('/api/option/sidebar-config')
  return res.data
}

export async function saveSidebarConfig(
  config: SidebarConfigData
): Promise<{ success: boolean; message?: string }> {
  const res = await api.put('/api/option/sidebar-config', config)
  return res.data
}
