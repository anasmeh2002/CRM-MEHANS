import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  height?: number;
}

const LOGO_SRC = '/logo.png';

export function MehansLogo({ className, height = 44 }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-2.5', className)} style={{ height: `${height}px` }}>
      <MehansLogoIcon size={height} />
      <span
        className="font-serif font-semibold tracking-[0.18em] leading-none"
        style={{ fontSize: `${height * 0.42}px`, color: 'var(--logo-text)' }}
      >
        MEHANS
      </span>
    </div>
  );
}

export function MehansLogoIcon({ size = 42, className }: { size?: number; className?: string }) {
  return (
    <img
      src={LOGO_SRC}
      alt="MEHANS"
      width={size}
      height={size}
      className={cn('shrink-0 rounded-xl object-cover', className)}
    />
  );
}
