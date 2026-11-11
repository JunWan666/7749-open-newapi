import { api } from '@/lib/api'

export type SidebarLinkData = {
  name: string
  url: string
  /** 站内内嵌显示（iframe）；关闭则新窗口打开。 */
  embed: boolean
}

export type SidebarGroupData = {
  title: string
  show_playground: boolean
  show_chat_presets: boolean
  flat_chat_presets: boolean
  links: SidebarLinkData[]
}

export type SidebarConfigData = {
  groups: SidebarGroupData[]
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
