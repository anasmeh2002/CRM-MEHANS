'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import {
  LayoutDashboard, Users, Home, KanbanSquare, TrendingUp,
  Calendar, CheckSquare, CalendarClock, MessageCircle, BarChart3,
  Sparkles, FileText, Settings, ChevronLeft, X,
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
  const agencyName = agency?.name ?? 'MEHANS Real Estate';

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-30 hidden h-screen flex-col border-r border-border bg-bg-secondary transition-all duration-300 ease-lux lg:flex',
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
                <div className="text-[10px] text-text-muted">Enterprise Workspace</div>
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
                <motion.div layoutId="sidebar-active-bar" className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r-full bg-gold" transition={{ type: 'spring', stiffness: 400, damping: 35 }} />
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
          <ChevronLeft className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')} strokeWidth={1.5} />
          {!collapsed && <span>{t('nav.collapse')}</span>}
        </button>
      </div>
    </aside>
  );
}

export function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { t } = useLanguage();

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
          />
          <motion.aside
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className="fixed left-0 top-0 z-50 flex h-screen w-[280px] flex-col border-r border-border bg-bg-secondary lg:hidden rtl:left-auto rtl:right-0 rtl:border-l rtl:border-r-0"
          >
            <div className="flex items-center justify-between px-6 pb-6 pt-8">
              <MehansLogo height={42} />
              <button onClick={onClose} className="rounded-lg p-1.5 text-text-muted hover:bg-bg-elevated hover:text-text-primary">
                <X className="h-5 w-5" strokeWidth={1.5} />
              </button>
            </div>
            <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 py-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      'mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-all',
                      active ? 'bg-bg-elevated text-text-primary' : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary'
                    )}
                  >
                    <Icon className={cn('h-[18px] w-[18px] shrink-0', active && 'text-gold')} strokeWidth={1.5} />
                    {t(item.labelKey)}
                  </Link>
                );
              })}
            </nav>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
