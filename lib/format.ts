export type CurrencyCode = 'MAD' | 'EUR' | 'USD' | 'AED' | 'GBP';

export const CURRENCY_OPTIONS: Array<{ value: CurrencyCode; label: string }> = [
  { value: 'MAD', label: 'MAD (DH)' },
  { value: 'EUR', label: 'EUR (€)' },
  { value: 'USD', label: 'USD ($)' },
  { value: 'AED', label: 'AED (د.إ)' },
  { value: 'GBP', label: 'GBP (£)' },
];

const currencySymbols: Record<CurrencyCode, string> = {
  MAD: 'DH',
  EUR: '€',
  USD: '$',
  AED: 'د.إ',
  GBP: '£',
};

export function formatCurrency(value: number, currency: CurrencyCode = 'MAD', locale = 'en-US'): string {
  const amount = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(value);
  return currency === 'MAD' ? `${amount} DH` : `${currencySymbols[currency]}${amount}`;
}

export function formatNumber(value: number, locale = 'en-US'): string {
  return new Intl.NumberFormat(locale).format(value);
}
