import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function safeConfig<T>(config: Record<string, T>, key: string | undefined | null, fallback: T): T {
  if (key && config[key]) return config[key];
  return fallback;
}
