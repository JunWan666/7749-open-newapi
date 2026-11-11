import { useQuery, useQueryClient } from '@tanstack/react-query'
import { GripVertical, Plus, Save, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'

import {
  getSidebarConfig,
  saveSidebarConfig,
  type SidebarConfigData,
} from './api'

/**
 * 侧边栏「聊天和娱乐」分组配置：组名、游乐场开关、聊天预设平铺、自定义快捷菜单。
 */
export function SidebarConfigPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<SidebarConfigData | null>(null)
  const [saving, setSaving] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['sidebar-config-admin'],
    queryFn: getSidebarConfig,
    staleTime: 0,
  })

  const config: SidebarConfigData | null = draft ?? data?.data ?? null

  function patchConfig(patch: Partial<SidebarConfigData>) {
    if (!config) {
      return
    }
    setDraft({ ...config, ...patch })
  }

  function patchLink(index: number, patch: Partial<{ name: string; url: string }>) {
    if (!config) {
      return
    }
    const links = config.links.map((link, i) =>
      i === index ? { ...link, ...patch } : link
    )
    setDraft({ ...config, links })
  }

  function addLink() {
    if (!config) {
      return
    }
    setDraft({
      ...config,
      links: [...config.links, { name: '', url: 'https://' }],
    })
  }

  function removeLink(index: number) {
    if (!config) {
      return
    }
    setDraft({ ...config, links: config.links.filter((_, i) => i !== index) })
  }

  function moveLink(index: number, direction: -1 | 1) {
    if (!config) {
      return
    }
    const next = index + direction
    if (next < 0 || next >= config.links.length) {
      return
    }
    const links = [...config.links]
    const [moved] = links.splice(index, 1)
    links.splice(next, 0, moved)
    setDraft({ ...config, links })
  }

  async function handleSave() {
    if (!config) {
      return
    }
    const invalid = config.links.some(
      (link) =>
        link.name.trim() === '' ||
        !/^https?:\/\//.test(link.url.trim())
    )
    if (invalid) {
      toast.error(t('Each menu needs a name and an http(s) address'))
      return
    }
    setSaving(true)
    try {
      const res = await saveSidebarConfig({
        ...config,
        links: config.links.map((link) => ({
          name: link.name.trim(),
          url: link.url.trim(),
        })),
      })
      if (res?.success) {
        toast.success(t('Saved'))
        setDraft(null)
        await queryClient.invalidateQueries({ queryKey: ['sidebar-config-admin'] })
        await queryClient.invalidateQueries({ queryKey: ['sidebar-fork-config'] })
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
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Sidebar Menu')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Button
          size='sm'
          disabled={saving || !config}
          onClick={() => {
            void handleSave()
          }}
        >
          <Save className='mr-1.5 size-4' />
          {t('Save')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        {isLoading || !config ? (
          <Skeleton className='h-80 w-full max-w-3xl rounded-xl' />
        ) : (
          <div className='flex max-w-3xl flex-col gap-5'>
            <p className='text-muted-foreground text-sm'>
              {t(
                'Controls the sidebar group shown above the dashboard: its name, whether the playground stays visible, and any extra shortcuts. Saving applies immediately.'
              )}
            </p>

            <div className='bg-card flex flex-col gap-4 rounded-xl border p-4 shadow-sm'>
              <div className='flex flex-col gap-1.5'>
                <label className='text-sm font-semibold'>{t('Group name')}</label>
                <Input
                  value={config.group_title}
                  onChange={(event) =>
                    patchConfig({ group_title: event.target.value })
                  }
                  placeholder='聊天和娱乐'
                />
              </div>

              <div className='flex items-center justify-between gap-4'>
                <div>
                  <div className='text-sm font-semibold'>
                    {t('Show playground')}
                  </div>
                  <div className='text-muted-foreground text-xs'>
                    {t('Keep the built-in /playground entry in this group')}
                  </div>
                </div>
                <Switch
                  checked={config.show_playground}
                  onCheckedChange={(checked) =>
                    patchConfig({ show_playground: Boolean(checked) })
                  }
                />
              </div>

              <div className='flex items-center justify-between gap-4'>
                <div>
                  <div className='text-sm font-semibold'>
                    {t('Show chat entries directly')}
                  </div>
                  <div className='text-muted-foreground text-xs'>
                    {t(
                      'List presets like AI 生图 as top-level items instead of inside a collapsible “Chat” menu'
                    )}
                  </div>
                </div>
                <Switch
                  checked={config.flat_chat_presets}
                  onCheckedChange={(checked) =>
                    patchConfig({ flat_chat_presets: Boolean(checked) })
                  }
                />
              </div>
            </div>

            <div className='bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-sm'>
              <div className='flex items-center justify-between gap-3'>
                <div>
                  <div className='text-sm font-semibold'>
                    {t('Custom shortcuts')}
                  </div>
                  <div className='text-muted-foreground text-xs'>
                    {t('Shown below the chat entries, opened in a new tab')}
                  </div>
                </div>
                <Button size='sm' variant='outline' onClick={addLink}>
                  <Plus className='mr-1 size-3.5' />
                  {t('Add menu')}
                </Button>
              </div>

              {config.links.length === 0 ? (
                <div className='text-muted-foreground rounded-lg border border-dashed px-4 py-6 text-center text-xs'>
                  {t('No custom menus yet')}
                </div>
              ) : (
                <div className='flex flex-col gap-2'>
                  {config.links.map((link, index) => (
                    <div key={`link-${index}`} className='flex items-center gap-2'>
                      <GripVertical className='text-muted-foreground/50 size-4 shrink-0' />
                      <Input
                        value={link.name}
                        onChange={(event) =>
                          patchLink(index, { name: event.target.value })
                        }
                        placeholder={t('Menu name')}
                        className='w-40 shrink-0'
                      />
                      <Input
                        value={link.url}
                        onChange={(event) =>
                          patchLink(index, { url: event.target.value })
                        }
                        placeholder='https://'
                        className='min-w-0 flex-1'
                      />
                      <div className='flex shrink-0 items-center'>
                        <Button
                          size='icon'
                          variant='ghost'
                          className='size-8'
                          aria-label={t('Move up')}
                          onClick={() => moveLink(index, -1)}
                        >
                          <span className='text-xs'>↑</span>
                        </Button>
                        <Button
                          size='icon'
                          variant='ghost'
                          className='size-8'
                          aria-label={t('Move down')}
                          onClick={() => moveLink(index, 1)}
                        >
                          <span className='text-xs'>↓</span>
                        </Button>
                        <Button
                          size='icon'
                          variant='ghost'
                          className='text-destructive size-8'
                          aria-label={t('Delete')}
                          onClick={() => removeLink(index)}
                        >
                          <Trash2 className='size-3.5' />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
