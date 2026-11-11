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
  type SidebarGroupData,
  type SidebarLinkData,
} from './api'

type GroupHandlers = {
  onPatch: (patch: Partial<SidebarGroupData>) => void
  onRemove: () => void
  onAddLink: () => void
  onPatchLink: (index: number, patch: Partial<SidebarLinkData>) => void
  onRemoveLink: (index: number) => void
  onMoveLink: (index: number, direction: -1 | 1) => void
}

/** 侧边栏自定义分组编辑（组名 / 内置入口 / 外链菜单 / 内嵌显示）。 */
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

  function updateGroup(index: number, patch: Partial<SidebarGroupData>) {
    if (!config) {
      return
    }
    setDraft({
      ...config,
      groups: config.groups.map((group, i) =>
        i === index ? { ...group, ...patch } : group
      ),
    })
  }

  function addGroup() {
    if (!config || config.groups.length >= 4) {
      return
    }
    setDraft({
      ...config,
      groups: [
        ...config.groups,
        {
          title: t('New group'),
          show_playground: false,
          show_chat_presets: false,
          flat_chat_presets: false,
          links: [],
        },
      ],
    })
  }

  function removeGroup(index: number) {
    if (!config) {
      return
    }
    setDraft({
      ...config,
      groups: config.groups.filter((_, i) => i !== index),
    })
  }

  function addLink(groupIndex: number) {
    if (!config) {
      return
    }
    updateGroup(groupIndex, {
      links: [
        ...config.groups[groupIndex].links,
        { name: '', url: 'https://', embed: true },
      ],
    })
  }

  function patchLink(
    groupIndex: number,
    linkIndex: number,
    patch: Partial<SidebarLinkData>
  ) {
    if (!config) {
      return
    }
    updateGroup(groupIndex, {
      links: config.groups[groupIndex].links.map((link, i) =>
        i === linkIndex ? { ...link, ...patch } : link
      ),
    })
  }

  function removeLink(groupIndex: number, linkIndex: number) {
    if (!config) {
      return
    }
    updateGroup(groupIndex, {
      links: config.groups[groupIndex].links.filter((_, i) => i !== linkIndex),
    })
  }

  function moveLink(groupIndex: number, linkIndex: number, direction: -1 | 1) {
    if (!config) {
      return
    }
    const links = [...config.groups[groupIndex].links]
    const next = linkIndex + direction
    if (next < 0 || next >= links.length) {
      return
    }
    const [moved] = links.splice(linkIndex, 1)
    links.splice(next, 0, moved)
    updateGroup(groupIndex, { links })
  }

  async function handleSave() {
    if (!config) {
      return
    }
    const invalidTitle = config.groups.some(
      (group) => group.title.trim() === ''
    )
    const invalidLink = config.groups.some((group) =>
      group.links.some(
        (link) =>
          link.name.trim() === '' || !/^https?:\/\//.test(link.url.trim())
      )
    )
    if (invalidTitle || invalidLink) {
      toast.error(t('Each menu needs a name and an http(s) address'))
      return
    }
    setSaving(true)
    try {
      const res = await saveSidebarConfig({
        groups: config.groups.map((group) => ({
          ...group,
          title: group.title.trim(),
          links: group.links.map((link) => ({
            name: link.name.trim(),
            url: link.url.trim(),
            embed: link.embed,
          })),
        })),
      })
      if (res?.success) {
        toast.success(t('Saved'))
        setDraft(null)
        await queryClient.invalidateQueries({
          queryKey: ['sidebar-config-admin'],
        })
        await queryClient.invalidateQueries({
          queryKey: ['sidebar-fork-config'],
        })
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
                'Edit the sidebar groups shown above the dashboard. Chat presets like AI 生图 open inside the console and keep their automatic API key; custom shortcuts can open inline or in a new tab. Saving applies immediately.'
              )}
            </p>

            {config.groups.map((group, groupIndex) => (
              <GroupCard
                key={`group-${groupIndex}`}
                group={group}
                handlers={{
                  onPatch: (patch) => updateGroup(groupIndex, patch),
                  onRemove: () => removeGroup(groupIndex),
                  onAddLink: () => addLink(groupIndex),
                  onPatchLink: (linkIndex, patch) =>
                    patchLink(groupIndex, linkIndex, patch),
                  onRemoveLink: (linkIndex) =>
                    removeLink(groupIndex, linkIndex),
                  onMoveLink: (linkIndex, direction) =>
                    moveLink(groupIndex, linkIndex, direction),
                }}
              />
            ))}

            {config.groups.length < 4 && (
              <Button variant='outline' size='sm' onClick={addGroup}>
                <Plus className='mr-1 size-4' />
                {t('Add group')}
              </Button>
            )}
          </div>
        )}
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

function GroupCard(props: { group: SidebarGroupData; handlers: GroupHandlers }) {
  const { t } = useTranslation()
  const group = props.group
  const handlers = props.handlers

  return (
    <div className='bg-card flex flex-col gap-4 rounded-xl border p-4 shadow-sm'>
      <div className='flex items-end gap-2'>
        <div className='flex flex-1 flex-col gap-1.5'>
          <label className='text-sm font-semibold'>{t('Group name')}</label>
          <Input
            value={group.title}
            onChange={(event) => handlers.onPatch({ title: event.target.value })}
            placeholder={t('Group name')}
          />
        </div>
        <Button
          size='icon'
          variant='ghost'
          className='text-destructive size-9'
          aria-label={t('Delete group')}
          onClick={handlers.onRemove}
        >
          <Trash2 className='size-4' />
        </Button>
      </div>

      <div className='flex items-center justify-between gap-4'>
        <div>
          <div className='text-sm font-semibold'>{t('Show chat presets')}</div>
          <div className='text-muted-foreground text-xs'>
            {t('Built-in entries such as AI 生图')}
          </div>
        </div>
        <Switch
          checked={group.show_chat_presets}
          onCheckedChange={(checked) =>
            handlers.onPatch({ show_chat_presets: Boolean(checked) })
          }
        />
      </div>

      {group.show_chat_presets && (
        <div className='flex items-center justify-between gap-4'>
          <div>
            <div className='text-sm font-semibold'>
              {t('Show chat entries directly')}
            </div>
            <div className='text-muted-foreground text-xs'>
              {t('Skip the collapsible “Chat” wrapper')}
            </div>
          </div>
          <Switch
            checked={group.flat_chat_presets}
            onCheckedChange={(checked) =>
              handlers.onPatch({ flat_chat_presets: Boolean(checked) })
            }
          />
        </div>
      )}

      <div className='flex items-center justify-between gap-4'>
        <div>
          <div className='text-sm font-semibold'>{t('Show playground')}</div>
          <div className='text-muted-foreground text-xs'>
            {t('Keep the built-in /playground entry in this group')}
          </div>
        </div>
        <Switch
          checked={group.show_playground}
          onCheckedChange={(checked) =>
            handlers.onPatch({ show_playground: Boolean(checked) })
          }
        />
      </div>

      <div className='flex flex-col gap-3 border-t pt-3'>
        <div className='flex items-center justify-between gap-3'>
          <div className='text-sm font-semibold'>{t('Custom shortcuts')}</div>
          <Button size='sm' variant='outline' onClick={handlers.onAddLink}>
            <Plus className='mr-1 size-3.5' />
            {t('Add menu')}
          </Button>
        </div>

        {group.links.length === 0 ? (
          <div className='text-muted-foreground rounded-lg border border-dashed px-4 py-5 text-center text-xs'>
            {t('No custom menus yet')}
          </div>
        ) : (
          group.links.map((link, linkIndex) => (
            <div
              key={`link-${linkIndex}`}
              className='flex flex-col gap-2 rounded-lg border p-2'
            >
              <div className='flex items-center gap-2'>
                <GripVertical className='text-muted-foreground/50 size-4 shrink-0' />
                <Input
                  value={link.name}
                  onChange={(event) =>
                    handlers.onPatchLink(linkIndex, {
                      name: event.target.value,
                    })
                  }
                  placeholder={t('Menu name')}
                  className='w-36 shrink-0'
                />
                <Input
                  value={link.url}
                  onChange={(event) =>
                    handlers.onPatchLink(linkIndex, { url: event.target.value })
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
                    onClick={() => handlers.onMoveLink(linkIndex, -1)}
                  >
                    <span className='text-xs'>↑</span>
                  </Button>
                  <Button
                    size='icon'
                    variant='ghost'
                    className='size-8'
                    aria-label={t('Move down')}
                    onClick={() => handlers.onMoveLink(linkIndex, 1)}
                  >
                    <span className='text-xs'>↓</span>
                  </Button>
                  <Button
                    size='icon'
                    variant='ghost'
                    className='text-destructive size-8'
                    aria-label={t('Delete')}
                    onClick={() => handlers.onRemoveLink(linkIndex)}
                  >
                    <Trash2 className='size-3.5' />
                  </Button>
                </div>
              </div>
              <div className='text-muted-foreground flex items-center gap-2 pl-6 text-[11px]'>
                <Switch
                  size='sm'
                  checked={link.embed}
                  onCheckedChange={(checked) =>
                    handlers.onPatchLink(linkIndex, { embed: Boolean(checked) })
                  }
                />
                <span>{t('Embed in console (iframe)')}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
