'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Bell, Plus, ChevronDown, Command, User, Settings, LogOut, Check, Menu,
  Users, Home, TrendingUp, CheckSquare, CalendarClock, Loader2, Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';
import { MehansLogoIcon } from '@/components/logo';
import { useGlobalModal } from '@/components/modal-provider';
import { useAuth } from '@/components/auth-provider';
import { useLanguage } from '@/components/language-provider';
import { useSupabaseQuery } from '@/hooks/use-supabase-query';
import {
  fetchNotifications, markNotificationRead, markAllNotificationsRead,
  globalSearch, type SearchResult, type NotificationRow,
  fetchAgency, type AgencyProfile,
} from '@/lib/data';

const quickActions = [
  { id: 'lead', labelKey: 'navbar.newLead', icon: Users, modal: 'lead' as const },
  { id: 'property', labelKey: 'navbar.newProperty', icon: Home, modal: 'property' as const },
  { id: 'deal', labelKey: 'navbar.newDeal', icon: TrendingUp, modal: 'deal' as const },
  { id: 'task', labelKey: 'navbar.newTask', icon: CheckSquare, modal: 'task' as const },
  { id: 'meeting', labelKey: 'navbar.newMeeting', icon: CalendarClock, modal: 'meeting' as const },
];

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function Navbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const { openModal } = useGlobalModal();
  const { user, signOut } = useAuth();
  const { t } = useLanguage();

  const { data: notifList, refetch: refetchNotifs } = useSupabaseQuery<NotificationRow[]>(fetchNotifications);
  const { data: agency } = useSupabaseQuery<AgencyProfile | null>(fetchAgency);

  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);

  const refs = {
    search: useRef<HTMLDivElement>(null),
    notif: useRef<HTMLDivElement>(null),
    quick: useRef<HTMLDivElement>(null),
    user: useRef<HTMLDivElement>(null),
  };

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (refs.search.current && !refs.search.current.contains(target)) setSearchOpen(false);
      if (refs.notif.current && !refs.notif.current.contains(target)) setNotifOpen(false);
      if (refs.quick.current && !refs.quick.current.contains(target)) setQuickOpen(false);
      if (refs.user.current && !refs.user.current.contains(target)) setUserOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await globalSearch(searchQuery);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const notifications = notifList ?? [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = async () => {
    setMarkingRead(true);
    try {
      await markAllNotificationsRead();
      toast.success('All notifications marked as read');
      refetchNotifs();
    } catch {
      toast.error('Failed to mark notifications as read');
    } finally {
      setMarkingRead(false);
    }
  };

  const handleNotifClick = async (notif: NotificationRow) => {
    if (!notif.read) {
      try {
        await markNotificationRead(notif.id);
        refetchNotifs();
      } catch { /* ignore */ }
    }
    setNotifOpen(false);
    if (notif.record_type && notif.record_id) {
      const routeMap: Record<string, string> = {
        lead: '/leads',
        property: '/properties',
        deal: '/deals',
        task: '/tasks',
        meeting: '/meetings',
        contact: '/contacts',
      };
      const route = routeMap[notif.record_type];
      if (route) router.push(route);
    }
  };

  const handleSearchResultClick = (result: SearchResult) => {
    setSearchOpen(false);
    setSearchQuery('');
    const routeMap: Record<string, string> = {
      lead: '/leads',
      property: '/properties',
      deal: '/deals',
      task: '/tasks',
      meeting: '/meetings',
    };
    router.push(routeMap[result.type] ?? '/');
  };

  const orgName = agency?.name ?? 'MEHANS Real Estate';

  return (
    <div className="sticky top-0 z-20 flex h-16 items-center gap-2 border-b border-border glass px-4 sm:gap-3 sm:px-5 lg:px-8">
      <button onClick={onMenuClick} className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-bg-secondary text-text-secondary transition-colors hover:border-border-strong lg:hidden">
        <Menu className="h-5 w-5" strokeWidth={1.5} />
      </button>

      <div className="relative hidden md:block">
        <button className="flex items-center gap-2.5 rounded-xl border border-border bg-bg-secondary px-3 py-2 text-[13px] transition-colors hover:border-border-strong">
          <MehansLogoIcon size={38} />
          <span className="font-medium text-text-primary">{orgName}</span>
          <ChevronDown className="h-4 w-4 text-text-muted" strokeWidth={1.5} />
        </button>
      </div>

      {/* Search */}
      <div ref={refs.search} className="relative min-w-0 flex-1 max-w-md">
        <button
          onClick={() => setSearchOpen(true)}
          className="flex w-full items-center gap-2 rounded-xl border border-border bg-bg-secondary px-3 py-2 text-[13px] text-text-muted transition-colors hover:border-border-strong"
        >
          <Search className="h-4 w-4" strokeWidth={1.5} />
          <span className="hidden sm:block">{t('navbar.search')}</span>
          <span className="sm:hidden">{t('navbar.searchShort')}</span>
          <kbd className="ml-auto hidden items-center gap-1 rounded-md border border-border bg-bg-elevated px-1.5 py-0.5 text-[10px] font-medium text-text-muted sm:flex">
            <Command className="h-3 w-3" />K
          </kbd>
        </button>
        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.12 }}
              className="absolute left-0 top-full mt-2 w-full rounded-xl border border-border bg-bg-elevated p-2 shadow-modal"
            >
              <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-secondary px-3 py-2">
                <Search className="h-4 w-4 text-text-muted" strokeWidth={1.5} />
                <input
                  autoFocus
                  placeholder={t('navbar.searchPlaceholder')}
                  className="flex-1 bg-transparent text-[13px] text-text-primary placeholder:text-text-muted focus:outline-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searching && <Loader2 className="h-4 w-4 animate-spin text-text-muted" />}
              </div>
              <div className="mt-2 max-h-80 overflow-y-auto">
                {searchQuery.trim() === '' ? (
                  <div className="px-3 py-6 text-center text-[12px] text-text-muted">{t('navbar.searchStart')}</div>
                ) : searchResults.length === 0 && !searching ? (
                  <div className="px-3 py-6 text-center text-[12px] text-text-muted">{t('navbar.searchNoResults')}</div>
                ) : (
                  searchResults.map((result) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleSearchResultClick(result)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13px] text-text-primary transition-colors hover:bg-bg-hover"
                    >
                      <Search className="h-4 w-4 text-text-muted" strokeWidth={1.5} />
                      <div className="flex-1">
                        <div className="font-medium">{result.label}</div>
                        <div className="text-[11px] text-text-muted">{result.subtitle}</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right */}
      <div className="ml-auto flex items-center gap-2">
        <LanguageSwitcher />
        <ThemeToggle />

        {/* AI Copilot button */}
        <button
          onClick={() => {
            const event = new CustomEvent('open-ai-copilot');
            window.dispatchEvent(event);
          }}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold-border bg-gold-bg text-gold transition-all hover:scale-105 hover:bg-gold-soft hover:text-[#0D0D0F]"
          title="AI Copilot"
        >
          <Sparkles className="h-[18px] w-[18px]" strokeWidth={1.5} />
        </button>

        {/* Quick Add */}
        <div ref={refs.quick} className="relative">
          <button onClick={() => setQuickOpen(!quickOpen)} className="btn btn-gold btn-md shrink-0">
            <Plus className="h-4 w-4" strokeWidth={2} />
            <span className="hidden sm:block">{t('navbar.quickAdd')}</span>
          </button>
          <AnimatePresence>
            {quickOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.12 }}
                className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border bg-bg-elevated p-1.5 shadow-modal"
              >
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.id}
                      onClick={() => { openModal(action.modal); setQuickOpen(false); }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[13px] text-text-primary transition-colors hover:bg-bg-hover"
                    >
                      <Icon className="h-4 w-4 text-text-muted" strokeWidth={1.5} /> {t(action.labelKey)}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Notifications */}
        <div ref={refs.notif} className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-bg-secondary transition-colors hover:border-border-strong"
          >
            <Bell className="h-[18px] w-[18px] text-text-secondary" strokeWidth={1.5} />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[10px] font-bold text-[#0D0D0F]">
                {unreadCount}
              </span>
            )}
          </button>
          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.12 }}
                className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] max-w-80 rounded-xl border border-border bg-bg-elevated shadow-modal"
              >
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <span className="text-[13px] font-semibold text-text-primary">{t('navbar.notifications')}</span>
                  <button
                    onClick={handleMarkAllRead}
                    disabled={markingRead || unreadCount === 0}
                    className="text-[12px] font-medium text-gold transition-colors hover:text-gold-soft disabled:opacity-50"
                  >
                    {markingRead ? t('navbar.marking') : t('navbar.markAllRead')}
                  </button>
                </div>
                <div className="scrollbar-thin max-h-80 overflow-y-auto p-1.5">
                  {notifications.length === 0 ? (
                    <div className="px-3 py-8 text-center text-[12px] text-text-muted">{t('navbar.noNotifications')}</div>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => handleNotifClick(n)}
                        className={cn('flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-bg-hover', !n.read && 'bg-gold-bg')}
                      >
                        <div className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', !n.read ? 'bg-gold' : 'bg-transparent border border-border-strong')} />
                        <div className="flex-1">
                          <div className="text-[13px] font-medium text-text-primary">{n.title}</div>
                          {n.description && <div className="text-[12px] text-text-secondary">{n.description}</div>}
                          <div className="mt-1 text-[11px] text-text-muted">{timeAgo(n.created_at)}</div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User */}
        <div ref={refs.user} className="relative">
          <button
            onClick={() => setUserOpen(!userOpen)}
            className="flex items-center gap-2 rounded-xl border border-border bg-bg-secondary py-1.5 pl-1.5 pr-2 transition-colors hover:border-border-strong"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gold text-xs font-bold text-[#0D0D0F]">{(user?.user_metadata?.full_name ?? user?.email ?? 'U').slice(0, 2).toUpperCase()}</div>
            <ChevronDown className="h-4 w-4 text-text-muted" strokeWidth={1.5} />
          </button>
          <AnimatePresence>
            {userOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.12 }}
                className="absolute right-0 top-full mt-2 w-56 rounded-xl border border-border bg-bg-elevated p-1.5 shadow-modal"
              >
                <div className="border-b border-border px-3 py-3">
                  <div className="text-[13px] font-medium text-text-primary">{user?.user_metadata?.full_name ?? 'Workspace user'}</div>
                  <div className="text-[12px] text-text-muted">{user?.email}</div>
                </div>
                <button
                  onClick={() => { setUserOpen(false); router.push('/settings'); }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[13px] text-text-primary transition-colors hover:bg-bg-hover"
                >
                  <User className="h-4 w-4 text-text-muted" strokeWidth={1.5} /> Profile
                </button>
                <button
                  onClick={() => { setUserOpen(false); router.push('/settings'); }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[13px] text-text-primary transition-colors hover:bg-bg-hover"
                >
                  <Settings className="h-4 w-4 text-text-muted" strokeWidth={1.5} /> Settings
                </button>
                <div className="my-1 h-px bg-border" />
                <button
                  onClick={async () => { try { await signOut(); router.replace('/login'); } catch { toast.error('Unable to sign out'); } }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[13px] text-error transition-colors hover:bg-error-bg"
                >
                  <LogOut className="h-4 w-4" strokeWidth={1.5} /> Sign Out
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
