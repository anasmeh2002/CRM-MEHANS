'use client';

import { useTheme } from 'next-themes';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useEffect, useState } from 'react';

const themes = ['light', 'dark', 'system'] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="h-10 w-10 shrink-0" />;

  const current = (theme ?? 'dark') as typeof themes[number];
  const next = themes[(themes.indexOf(current) + 1) % themes.length];
  const Icon = current === 'dark' ? Moon : current === 'light' ? Sun : Monitor;
  const label = current === 'dark' ? 'Dark' : current === 'light' ? 'Light' : 'System';

  return (
    <button
      onClick={() => setTheme(next)}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-bg-secondary transition-all duration-200 hover:border-border-strong active:scale-95"
      title={`Theme: ${label} (click for ${next})`}
    >
      <Icon className="h-[18px] w-[18px] text-text-secondary" strokeWidth={1.5} />
    </button>
  );
}
