'use client';

import { useState, useRef, useEffect } from 'react';
import { Globe, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/components/language-provider';
import { locales, localeNames, type Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-bg-secondary text-text-secondary transition-colors hover:border-border-strong"
        title={t('navbar.language')}
      >
        <Globe className="h-[18px] w-[18px]" strokeWidth={1.5} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.12 }}
            className="absolute end-0 top-full z-50 mt-2 w-44 max-w-[calc(100vw-1rem)] rounded-xl border border-border bg-bg-elevated p-1.5 shadow-modal"
          >
            {locales.map((l: Locale) => (
              <button
                key={l}
                onClick={() => {
                  setLocale(l);
                  setOpen(false);
                }}
                className={cn(
                  'flex min-h-11 w-full items-center justify-between rounded-lg px-3 py-2.5 text-[13px] transition-colors',
                  locale === l ? 'bg-gold-bg text-gold' : 'text-text-primary hover:bg-bg-hover',
                )}
              >
                <span>{localeNames[l]}</span>
                {locale === l && <Check className="h-3.5 w-3.5" strokeWidth={2} />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
