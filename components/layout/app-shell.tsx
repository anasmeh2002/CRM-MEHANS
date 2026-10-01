'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sidebar, MobileNav } from './sidebar';
import { Navbar } from './navbar';
import { AICopilot } from '@/components/ai-copilot';
import { useLanguage } from '@/components/language-provider';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { rtl } = useLanguage();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div dir={rtl ? 'rtl' : 'ltr'} className="min-h-screen bg-bg-primary bg-grid">
      <Sidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} />
      <div className={collapsed ? 'lg:ps-20' : 'lg:ps-[260px]'}>
        <Navbar onMenuClick={() => setMobileNavOpen(true)} />
        <motion.main
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
          className="px-4 py-5 sm:px-5 lg:px-8 lg:py-8"
        >
          {children}
        </motion.main>
      </div>
      <MobileNav open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <AICopilot />
    </div>
  );
}
