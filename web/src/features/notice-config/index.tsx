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
import { useQuery } from '@tanstack/react-query'
import { Plus, Save, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { getNoticeConfig, saveNoticeConfig } from './api'

type NoticeBlock = {
  title: string
  description: string
  steps: string[]
  footer: string
  note: string
}

type NoticeContact = {
  name: string
  role: string
  avatar: string
}

type NoticeConfig = {
  pending: NoticeBlock
  restricted: NoticeBlock
  contacts: NoticeContact[]
}

function emptyBlock(): NoticeBlock {
  return { title: '', description: '', steps: [], footer: '', note: '' }
}

/** 账号受限 / 待审核 提示文案编辑（管理员） */
export function NoticeConfigPage() {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<NoticeConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'pending' | 'restricted'>('restricted')

  const { data, isLoading } = useQuery({
    queryKey: ['notice-config-admin'],
    queryFn: getNoticeConfig,
    staleTime: 0,
  })

  const config: NoticeConfig | null = draft ?? data?.data ?? null

  function patchBlock(key: 'pending' | 'restricted', patch: Partial<NoticeBlock>) {
    if (!config) {
      return
    }
    setDraft({
      ...config,
      [key]: { ...(config[key] ?? emptyBlock()), ...patch },
    })
  }

  function patchContact(index: number, patch: Partial<NoticeContact>) {
    if (!config) {
      return
    }
    const next = config.contacts.map((item, i) =>
      i === index ? { ...item, ...patch } : item
    )
    setDraft({ ...config, contacts: next })
  }

  function addContact() {
    if (!config || config.contacts.length >= 4) {
      return
    }
    setDraft({
      ...config,
      contacts: [...config.contacts, { name: '', role: '', avatar: '' }],
    })
  }

  function removeContact(index: number) {
    if (!config) {
      return
    }
    setDraft({
      ...config,
      contacts: config.contacts.filter((_, i) => i !== index),
    })
  }

  async function handleSave() {
    if (!config || saving) {
      return
    }
    setSaving(true)
    try {
      const res = await saveNoticeConfig(config)
      if (res?.success) {
        toast.success(t('Saved'))
        setDraft(null)
      } else {
        toast.error(res?.message || t('Save failed'))
      }
    } catch {
      toast.error(t('Save failed'))
    } finally {
      setSaving(false)
    }
  }

  function blockForm(key: 'pending' | 'restricted') {
    const block = config?.[key] ?? emptyBlock()
    return (
      <div className='bg-card flex flex-col gap-4 rounded-xl border p-4 shadow-sm sm:p-5'>
        <div className='flex flex-col gap-1.5'>
          <label className='text-sm font-semibold'>{t('Title')}</label>
          <Input
            value={block.title}
            onChange={(event) => patchBlock(key, { title: event.target.value })}
            placeholder={t('Account restricted')}
          />
        </div>

        <div className='flex flex-col gap-1.5'>
          <label className='text-sm font-semibold'>{t('Banner headline')}</label>
          <textarea
            value={block.description}
            onChange={(event) =>
              patchBlock(key, { description: event.target.value })
            }
            rows={2}
            className='border-input bg-transparent focus-visible:ring-ring/50 w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-2'
            placeholder={t('Shown in the top banner and dialog')}
          />
        </div>

        <div className='flex flex-col gap-1.5'>
          <label className='text-sm font-semibold'>
            {t('Steps (one per line)')}
          </label>
          <textarea
            value={block.steps.join('\n')}
            onChange={(event) =>
              patchBlock(key, {
                steps: event.target.value
                  .split('\n')
                  .map((line) => line.trim())
                  .filter(Boolean),
              })
            }
            rows={5}
            className='border-input bg-transparent focus-visible:ring-ring/50 w-full rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-2'
          />
        </div>

        <div className='flex flex-col gap-1.5'>
          <label className='text-sm font-semibold'>{t('Footer line')}</label>
          <Input
            value={block.footer}
            onChange={(event) => patchBlock(key, { footer: event.target.value })}
          />
        </div>

        <div className='flex flex-col gap-1.5'>
          <label className='text-sm font-semibold'>{t('Extra note')}</label>
          <Input
            value={block.note}
            onChange={(event) => patchBlock(key, { note: event.target.value })}
            placeholder={t('Optional')}
          />
        </div>
      </div>
    )
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Notice Copy')}</SectionPageLayout.Title>
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
        <div className='flex max-w-3xl flex-col gap-5'>
          <p className='text-muted-foreground text-sm'>
            {t(
              'This copy drives the banner and dialog shown to pending-review and restricted accounts. Changes take effect immediately after saving.'
            )}
          </p>

          {isLoading ? (
            <Skeleton className='h-96 w-full rounded-xl' />
          ) : (
            <>
              <Tabs
                value={tab}
                onValueChange={(value) =>
                  setTab(value as 'pending' | 'restricted')
                }
              >
                <TabsList className='grid w-full max-w-xs grid-cols-2'>
                  <TabsTrigger value='restricted'>
                    {t('Account restricted')}
                  </TabsTrigger>
                  <TabsTrigger value='pending'>{t('Pending review')}</TabsTrigger>
                </TabsList>
                <TabsContent value='restricted' className='mt-4'>
                  {blockForm('restricted')}
                </TabsContent>
                <TabsContent value='pending' className='mt-4'>
                  {blockForm('pending')}
                </TabsContent>
              </Tabs>

              <div className='bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-sm sm:p-5'>
                <div className='flex items-center justify-between'>
                  <span className='text-sm font-semibold'>
                    {t('Contacts shown in the dialog')}
                  </span>
                  <Button
                    size='sm'
                    variant='outline'
                    disabled={(config?.contacts.length ?? 0) >= 4}
                    onClick={addContact}
                  >
                    <Plus className='mr-1 size-3.5' />
                    {t('Add')}
                  </Button>
                </div>
                <div className='flex flex-col gap-2'>
                  {(config?.contacts ?? []).map((contact, index) => (
                    <div
                      key={`${contact.name}-${contact.avatar}-${contact.role}`}
                      className='flex flex-wrap items-center gap-2'
                    >
                      {contact.avatar ? (
                        <img
                          src={contact.avatar}
                          alt={contact.name}
                          className='size-9 rounded-full border object-cover'
                        />
                      ) : (
                        <span className='bg-muted flex size-9 items-center justify-center rounded-full text-xs'>
                          ?
                        </span>
                      )}
                      <Input
                        value={contact.name}
                        onChange={(event) =>
                          patchContact(index, { name: event.target.value })
                        }
                        placeholder={t('Name')}
                        className='h-8 w-28 text-xs'
                      />
                      <Input
                        value={contact.role}
                        onChange={(event) =>
                          patchContact(index, { role: event.target.value })
                        }
                        placeholder={t('Role')}
                        className='h-8 w-24 text-xs'
                      />
                      <Input
                        value={contact.avatar}
                        onChange={(event) =>
                          patchContact(index, { avatar: event.target.value })
                        }
                        placeholder='/api/contact-avatar/iz.jpg'
                        className='h-8 flex-1 text-xs'
                      />
                      <Button
                        size='sm'
                        variant='ghost'
                        onClick={() => removeContact(index)}
                      >
                        <Trash2 className='size-3.5' />
                      </Button>
                    </div>
                  ))}
                </div>
                <p className='text-muted-foreground text-xs'>
                  {t(
                    'Avatar can be a URL, or upload the image to the server data volume and use /api/contact-avatar/<file>.'
                  )}
                </p>
              </div>
            </>
          )}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
