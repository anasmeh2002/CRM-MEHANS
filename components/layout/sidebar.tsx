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

const navItems = [
  { label: 'Overview', href: '/', icon: LayoutDashboard },
  { label: 'Leads', href: '/leads', icon: Users },
  { label: 'Properties', href: '/properties', icon: Home },
  { label: 'Pipeline', href: '/pipeline', icon: KanbanSquare },
  { label: 'Deals', href: '/deals', icon: TrendingUp },
  { label: 'Calendar', href: '/calendar', icon: Calendar },
  { label: 'Tasks', href: '/tasks', icon: CheckSquare },
  { label: 'Meetings', href: '/meetings', icon: CalendarClock },
  { label: 'WhatsApp', href: '/whatsapp', icon: MessageCircle },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
  { label: 'AI Assistant', href: '/ai-assistant', icon: Sparkles },
  { label: 'Reports', href: '/reports', icon: FileText },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar({ collapsed, onToggleCollapse }: { collapsed: boolean; onToggleCollapse: () => void }) {
  const pathname = usePathname();

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
                <div className="truncate text-[12px] font-medium text-text-primary">MEHANS Real Estate</div>
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
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative z-10 whitespace-nowrap">{item.label}</motion.span>
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
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}

export function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();

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
            className="fixed left-0 top-0 z-50 flex h-screen w-[280px] flex-col border-r border-border bg-bg-secondary lg:hidden"
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
                    {item.label}
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
