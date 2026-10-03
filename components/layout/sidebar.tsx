'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import {
  LayoutDashboard, Users, Home, KanbanSquare, TrendingUp,
  Calendar, CheckSquare, CalendarClock, MessageCircle, BarChart3,
  Sparkles, FileText, Settings, ChevronLeft, X, MoreHorizontal,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MehansLogo, MehansLogoIcon } from '@/components/logo';
import { useLanguage } from '@/components/language-provider';
import { useSupabaseQuery } from '@/hooks/use-supabase-query';
import { fetchAgency, type AgencyProfile } from '@/lib/data';

const navItems = [
  { labelKey: 'nav.overview', href: '/', icon: LayoutDashboard },
  { labelKey: 'nav.leads', href: '/leads', icon: Users },
  { labelKey: 'nav.properties', href: '/properties', icon: Home },
  { labelKey: 'nav.pipeline', href: '/pipeline', icon: KanbanSquare },
  { labelKey: 'nav.deals', href: '/deals', icon: TrendingUp },
  { labelKey: 'nav.calendar', href: '/calendar', icon: Calendar },
  { labelKey: 'nav.tasks', href: '/tasks', icon: CheckSquare },
  { labelKey: 'nav.meetings', href: '/meetings', icon: CalendarClock },
  { labelKey: 'nav.whatsapp', href: '/whatsapp', icon: MessageCircle },
  { labelKey: 'nav.analytics', href: '/analytics', icon: BarChart3 },
  { labelKey: 'nav.aiAssistant', href: '/ai-assistant', icon: Sparkles },
  { labelKey: 'nav.reports', href: '/reports', icon: FileText },
  { labelKey: 'nav.settings', href: '/settings', icon: Settings },
];

export function Sidebar({ collapsed, onToggleCollapse }: { collapsed: boolean; onToggleCollapse: () => void }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const { data: agency } = useSupabaseQuery<AgencyProfile | null>(fetchAgency);
  const agencyName = agency?.name ?? t('navbar.enterpriseWorkspace');

  return (
    <aside
      className={cn(
        'fixed left-0 rtl:right-0 rtl:left-auto top-0 z-30 hidden h-screen flex-col border-r rtl:border-l rtl:border-r-0 border-border bg-bg-secondary transition-all duration-300 ease-lux lg:flex',
        collapsed ? 'w-20' : 'w-[260px]'
      )}
    >
      <div className={cn('flex items-center px-5 pb-6 pt-8', collapsed && 'justify-center px-2')}>
        <Link href="/" className="flex items-center overflow-hidden">
          {collapsed ? <MehansLogoIcon size={42} /> : <MehansLogo height={42} />}
        </Link>
      </div>

      <div className="px-4 pb-5">
        {!collapsed ? (
          <div className="rounded-xl border border-border bg-bg-elevated px-3 py-2.5">
            <div className="flex items-center gap-2.5">
              <MehansLogoIcon size={38} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-medium text-text-primary">{agencyName}</div>
                <div className="text-[10px] text-text-muted">{t('navbar.enterpriseWorkspace')}</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex justify-center"><MehansLogoIcon size={42} /></div>
        )}
      </div>

      <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 py-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group relative mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all duration-200',
                active ? 'text-text-primary' : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary'
              )}
            >
              {active && (
                <motion.div layoutId="sidebar-active-bg" className="absolute inset-0 rounded-xl bg-bg-elevated" transition={{ type: 'spring', stiffness: 400, damping: 35 }} />
              )}
              {active && (
                <motion.div layoutId="sidebar-active-bar" className="absolute left-0 rtl:right-0 rtl:left-auto top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r-full rtl:rounded-l-full rtl:rounded-r-none bg-gold" transition={{ type: 'spring', stiffness: 400, damping: 35 }} />
              )}
              <Icon className={cn('relative z-10 h-[18px] w-[18px] shrink-0 transition-colors', active && 'text-gold')} strokeWidth={1.5} />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative z-10 whitespace-nowrap">{t(item.labelKey)}</motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <button
          onClick={onToggleCollapse}
          className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13px] text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary"
        >
          <ChevronLeft className={cn('h-4 w-4 transition-transform rtl:scale-x-[-1]', collapsed && 'rotate-180')} strokeWidth={1.5} />
          {!collapsed && <span>{t('nav.collapse')}</span>}
        </button>
      </div>
    </aside>
  );
}

export function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [moreOpen, setMoreOpen] = useState(false);
  const primaryItems = [navItems[0], navItems[1], navItems[2], navItems[5]];
  const moreItems = navItems.filter((item) => !primaryItems.includes(item));

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex h-[calc(4.25rem+env(safe-area-inset-bottom))] items-start justify-around border-t border-border bg-bg-secondary/95 px-1 pt-1.5 shadow-modal backdrop-blur-xl lg:hidden">
        {[...primaryItems, { labelKey: 'nav.more', href: '#more', icon: MoreHorizontal }].map((item) => {
          const Icon = item.icon;
          const active = item.href === '#more' ? moreOpen : pathname === item.href;
          return (
            <button
              key={item.href}
              onClick={() => item.href === '#more' ? setMoreOpen((value) => !value) : undefined}
              className={cn('flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-medium transition-colors', active ? 'text-gold' : 'text-text-muted')}
            >
              <Icon className="h-5 w-5" strokeWidth={1.6} />
              <span className="max-w-full truncate">{t(item.labelKey)}</span>
            </button>
          );
        })}
      </nav>
      <AnimatePresence>
        {moreOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMoreOpen(false)} className="fixed inset-0 z-40 bg-black/55 lg:hidden" />
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 grid grid-cols-3 gap-1.5 rounded-2xl border border-border bg-bg-elevated p-2 shadow-modal lg:hidden">
              {moreItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return <Link key={item.href} href={item.href} onClick={() => setMoreOpen(false)} className={cn('flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl text-[11px]', active ? 'bg-gold-bg text-gold' : 'text-text-secondary hover:bg-bg-hover')}><Icon className="h-4 w-4" strokeWidth={1.5} />{t(item.labelKey)}</Link>;
              })}
            </motion.div>
          </>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden" />
            <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} className="fixed inset-y-0 start-0 z-[60] flex w-[min(82vw,280px)] flex-col border-e border-border bg-bg-secondary p-4 shadow-modal lg:hidden">
              <div className="mb-5 flex items-center justify-between"><MehansLogo height={36} /><button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl border border-border text-text-muted"><X className="h-5 w-5" strokeWidth={1.5} /></button></div>
              <nav className="overflow-y-auto">{navItems.map((item) => { const Icon = item.icon; const active = pathname === item.href; return <Link key={item.href} href={item.href} onClick={onClose} className={cn('mb-1 flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm', active ? 'bg-bg-elevated text-gold' : 'text-text-secondary')}><Icon className="h-5 w-5" strokeWidth={1.5} />{t(item.labelKey)}</Link>; })}</nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
