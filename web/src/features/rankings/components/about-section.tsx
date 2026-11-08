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
import {
  BookOpen,
  Coins,
  Heart,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

type HealthResponse = {
  channels: Array<{ models: unknown[] }>
}

async function fetchModelStats(): Promise<{ channels: number; models: number }> {
  try {
    const res = await fetch('/rank-api/api/health')
    if (!res.ok) {
      return { channels: 0, models: 0 }
    }
    const data = (await res.json()) as HealthResponse
    const channels = data.channels?.length ?? 0
    const models = (data.channels ?? []).reduce(
      (sum, channel) => sum + (channel.models?.length ?? 0),
      0
    )
    return { channels, models }
  } catch {
    return { channels: 0, models: 0 }
  }
}

/** 「关于本站」标签页：站点介绍 + 数据概览 + 使用规则 */
export function AboutSection() {
  const { t } = useTranslation()
  const { data } = useQuery({
    queryKey: ['rank-api', 'about-stats'],
    queryFn: fetchModelStats,
    staleTime: 5 * 60_000,
  })

  const stats = data ?? { channels: 0, models: 0 }

  return (
    <section className='space-y-6'>
      <div className='bg-card relative overflow-hidden rounded-2xl border p-6 shadow-sm sm:p-8'>
        <div
          aria-hidden
          className='bg-primary/10 pointer-events-none absolute -top-16 -right-16 size-56 rounded-full blur-3xl'
        />
        <div className='relative flex flex-col gap-3'>
          <div className='flex items-center gap-2'>
            <Sparkles className='text-primary size-5' />
            <h2 className='text-xl font-semibold'>{t('About this site')}</h2>
          </div>
          <p className='text-muted-foreground max-w-2xl text-sm leading-relaxed'>
            {t(
              'A small AI gateway run by the site owner out of pocket. All supported models are free to use, with no application and no threshold — we believe technology should be warm and reachable by more people.'
            )}
          </p>
          <div className='mt-2 grid gap-3 sm:grid-cols-3'>
            <Stat label={t('Model channels')} value={String(stats.channels)} />
            <Stat label={t('Available models')} value={String(stats.models)} />
            <Stat label={t('Pricing')} value={t('Free')} />
          </div>
        </div>
      </div>

      <div className='grid gap-4 md:grid-cols-2'>
        <FeatureCard
          icon={<BookOpen className='size-4' />}
          title={t('What you get')}
          items={[
            t('One endpoint compatible with the OpenAI API'),
            t('Multiple upstream providers, automatic failover'),
            t('Usage dashboard, call logs and per-model statistics'),
            t('Daily check-in grants extra quota'),
          ]}
        />
        <FeatureCard
          icon={<Coins className='size-4' />}
          title={t('How quota works')}
          items={[
            t('New accounts receive 10,000 calls of quota'),
            t('Daily check-in grants 5,000–10,000 calls (requires real usage in the last 7 days)'),
            t('Each request costs 0.01 yuan of quota, regardless of model'),
            t('Quota accumulates — there is no expiry pressure'),
          ]}
        />
        <FeatureCard
          icon={<ShieldCheck className='size-4' />}
          title={t('Fair use')}
          items={[
            t('For personal use only — reselling or renting API keys is not allowed'),
            t('No bulk scraping, abusive concurrency or illegal content'),
            t('Abnormal usage is reviewed: reminder first, action later'),
            t('Share accounts are treated as suspicious and limited'),
          ]}
        />
        <div className='bg-card flex flex-col gap-3 rounded-xl border p-5 shadow-sm'>
          <div className='flex items-center gap-2'>
            <MessageCircle className='text-primary size-4' />
            <h3 className='text-sm font-semibold'>{t('Join the community')}</h3>
          </div>
          <p className='text-muted-foreground text-xs leading-relaxed'>
            {t(
              'Questions, model feedback or account review — the WeChat group is the fastest way to reach the admin.'
            )}
          </p>
          <img
            src='/api/group-qrcode'
            alt={t('WeChat Group QR Code')}
            className='mx-auto h-36 w-36 rounded-lg border bg-white object-contain p-1.5'
            onError={(event) => {
              event.currentTarget.style.display = 'none'
            }}
          />
          <p className='text-muted-foreground text-center text-[11px]'>
            {t('The QR code is refreshed by the admin when it expires.')}
          </p>
        </div>
      </div>

      <div className='text-muted-foreground flex flex-wrap items-center justify-center gap-1.5 pt-2 text-xs'>
        <Heart className='size-3.5' />
        <span>
          {t('Built on the open-source')}{' '}
          <a
            href='https://github.com/QuantumNous/new-api'
            target='_blank'
            rel='noreferrer'
            className='text-primary underline-offset-2 hover:underline'
          >
            New API
          </a>{' '}
          {t('project. Thanks to everyone who keeps it running.')}
        </span>
      </div>
    </section>
  )
}

function Stat(props: { label: string; value: string }) {
  return (
    <div className='bg-muted/50 rounded-lg px-3 py-2'>
      <div className='text-muted-foreground text-[11px]'>{props.label}</div>
      <div className='mt-0.5 text-base font-semibold tabular-nums'>
        {props.value}
      </div>
    </div>
  )
}

function FeatureCard(props: {
  icon: React.ReactNode
  title: string
  items: string[]
}) {
  return (
    <div className='bg-card flex flex-col gap-3 rounded-xl border p-5 shadow-sm'>
      <div className='flex items-center gap-2'>
        <span className='text-primary'>{props.icon}</span>
        <h3 className='text-sm font-semibold'>{props.title}</h3>
      </div>
      <ul className='text-muted-foreground flex flex-col gap-1.5 text-xs leading-relaxed'>
        {props.items.map((item) => (
          <li key={item} className='flex gap-2'>
            <span className='bg-primary/60 mt-1.5 size-1 shrink-0 rounded-full' />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
