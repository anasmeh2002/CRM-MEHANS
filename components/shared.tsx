'use client';

import { memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { MehansLogoIcon } from '@/components/logo';
import { useLanguage } from '@/components/language-provider';

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="mb-6 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between sm:gap-5"
    >
      <div>
        <h1 className="font-serif text-2xl font-medium tracking-tight text-text-primary sm:text-[32px]">{title}</h1>
        {description && <p className="mt-1.5 text-[13px] leading-relaxed text-text-secondary sm:mt-2 sm:text-[14px]">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2.5">{children}</div>}
    </motion.div>
  );
}

export const Card = memo(function Card({
  children,
  className,
  hover = false,
  delay = 0,
  padding = true,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  delay?: number;
  padding?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn('card', hover && 'card-hover', !padding && '!p-0', className)}
    >
      {children}
    </motion.div>
  );
});

export const StatCard = memo(function StatCard({
  label,
  value,
  change,
  icon: Icon,
  trend = 'up',
  delay = 0,
}: {
  label: string;
  value: string;
  change?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down';
  delay?: number;
}) {
  const { t } = useLanguage();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] }}
      className="group card card-hover"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="eyebrow">{label}</p>
          <p className="mt-3 font-serif text-2xl font-medium tracking-tight text-text-primary sm:mt-3.5 sm:text-[30px]">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-bg-elevated text-gold transition-colors group-hover:border-gold-border">
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
        </div>
      </div>
      {change && (
        <div className="mt-4 flex items-center gap-2">
          <span className={cn('flex items-center gap-1 text-[12px] font-medium', trend === 'up' ? 'text-gold' : 'text-error')}>
            {trend === 'up' ? '↑' : '↓'} {change}
          </span>
          <span className="text-[12px] text-text-muted">{t('common.vsLastMonth')}</span>
        </div>
      )}
    </motion.div>
  );
});

export const Badge = memo(function Badge({
  children,
  variant = 'neutral',
  className,
  style,
}: {
  children: React.ReactNode;
  variant?: 'gold' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
  className?: string;
  style?: React.CSSProperties;
}) {
  const variants: Record<string, string> = {
    gold: 'badge-gold',
    success: 'badge-success',
    warning: 'badge-warning',
    error: 'badge-error',
    info: 'badge-info',
    neutral: 'badge-neutral',
  };
  return (
    <span style={style} className={cn('badge', variants[variant], className)}>
      {children}
    </span>
  );
});

export const Avatar = memo(function Avatar({
  name,
  color = '#D4AF37',
  size = 'md',
}: {
  name: string;
  color?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const sizes = {
    xs: 'h-6 w-6 text-[9px] rounded-md',
    sm: 'h-8 w-8 text-[10px] rounded-lg',
    md: 'h-9 w-9 text-xs rounded-lg',
    lg: 'h-12 w-12 text-sm rounded-xl',
    xl: 'h-16 w-16 text-lg rounded-2xl',
  };
  return (
    <div className={cn('flex shrink-0 items-center justify-center font-semibold text-[#0D0D0F]', sizes[size])} style={{ background: color }}>
      {initials}
    </div>
  );
});

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton rounded-xl', className)} />;
}

export function SkeletonCard() {
  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-7 w-28" />
        </div>
        <Skeleton className="h-10 w-10 rounded-xl" />
      </div>
      <Skeleton className="h-3 w-24" />
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ElementType;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center sm:py-24">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-bg-elevated text-gold">
        <Icon className="h-8 w-8" strokeWidth={1.5} />
      </div>
      <h3 className="mt-6 font-serif text-xl font-medium text-text-primary">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-text-secondary">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn('font-serif text-lg font-medium text-text-primary', className)}>{children}</h3>;
}

export function PageLoader() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <MehansLogoIcon size={72} className="animate-pulse" />
    </div>
  );
}

export const ScoreBar = memo(function ScoreBar({ score, className }: { score: number; className?: string }) {
  const color = score >= 80 ? 'var(--success)' : score >= 50 ? 'var(--gold)' : 'var(--error)';
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="h-1.5 w-12 overflow-hidden rounded-full bg-bg-elevated">
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-[12px] font-medium text-text-primary">{score}</span>
    </div>
  );
});
