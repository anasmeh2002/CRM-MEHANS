'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronDown, Check, AlertCircle, Loader2, Calendar, Upload, Search } from 'lucide-react';
import { useState, useRef, useEffect, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/components/language-provider';

/* ============================================================
   PREMIUM FORM COMPONENTS — Stripe + Linear quality
   ============================================================ */

// ---- FIELD WRAPPER ----
export function Field({
  label,
  error,
  hint,
  required,
  children,
}: {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-[13px] font-medium text-text-primary">
          {label}
          {required && <span className="ms-0.5 text-gold">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="flex items-center gap-1.5 text-[12px] text-error">
          <AlertCircle className="h-3 w-3" /> {error}
        </p>
      ) : hint ? (
        <p className="text-[12px] text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

// ---- TEXT INPUT ----
export function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled,
  error,
  icon,
  className,
}: {
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  error?: boolean;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className="relative">
      {icon && (
        <div className="absolute left-3 rtl:right-3 rtl:left-auto top-1/2 -translate-y-1/2 text-text-muted">
          {icon}
        </div>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn('input', icon && 'ps-10', error && 'input-error', className)}
      />
    </div>
  );
}

// ---- TEXTAREA ----
export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 4,
  disabled,
  error,
  className,
}: {
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  error?: boolean;
  className?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      className={cn('input resize-none', error && 'input-error', className)}
    />
  );
}

// ---- SELECT ----
export function Select({
  value,
  onChange,
  options,
  placeholder = undefined,
  disabled,
  error,
}: {
  value?: string;
  onChange?: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
}) {
  const { t } = useLanguage();
  const placeholderText = placeholder ?? t('common.select');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={cn('input flex items-center justify-between text-start', error && 'input-error', disabled && 'opacity-50 cursor-not-allowed')}
      >
        <span className={cn(!selected && 'text-text-muted')}>{selected?.label || placeholderText}</span>
        <ChevronDown className={cn('h-4 w-4 text-text-muted transition-transform', open && 'rotate-180')} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-border bg-bg-elevated shadow-modal p-1"
          >
            <div className="max-h-60 overflow-y-auto">
              {options.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { onChange?.(opt.value); setOpen(false); }}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg px-3 py-2 text-[13px] transition-colors',
                    opt.value === value ? 'bg-gold-bg text-gold' : 'text-text-primary hover:bg-bg-hover'
                  )}
                >
                  {opt.label}
                  {opt.value === value && <Check className="h-3.5 w-3.5" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---- MULTI SELECT / TAG INPUT ----
export function TagInput({
  value = [],
  onChange,
  placeholder = undefined,
  suggestions = [],
}: {
  value?: string[];
  onChange?: (v: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
}) {
  const { t } = useLanguage();
  const placeholderText = placeholder ?? t('common.addTag');
  const [input, setInput] = useState('');
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setFocused(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const addTag = (tag: string) => {
    const t = tag.trim();
    if (t && !value.includes(t)) onChange?.([...value, t]);
    setInput('');
  };

  const removeTag = (tag: string) => {
    onChange?.(value.filter((t) => t !== tag));
  };

  const filteredSuggestions = suggestions.filter((s) => !value.includes(s) && s.toLowerCase().includes(input.toLowerCase()));

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => setFocused(true)}
        className={cn('input flex flex-wrap items-center gap-1.5 cursor-text min-h-[42px]', focused && 'border-[var(--border-focus)]')}
      >
        {value.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-gold-bg px-2 py-0.5 text-[11px] font-medium text-gold">
            {tag}
            <button onClick={(e) => { e.stopPropagation(); removeTag(tag); }} className="hover:text-text-primary">
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); addTag(input); }
            if (e.key === 'Backspace' && !input && value.length) removeTag(value[value.length - 1]);
          }}
          onFocus={() => setFocused(true)}
          placeholder={value.length === 0 ? placeholderText : ''}
          className="flex-1 bg-transparent text-[14px] text-text-primary placeholder:text-text-muted outline-none min-w-[80px]"
        />
      </div>
      <AnimatePresence>
        {focused && input && filteredSuggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-border bg-bg-elevated shadow-modal p-1"
          >
            {filteredSuggestions.slice(0, 5).map((s) => (
              <button
                key={s}
                onClick={() => addTag(s)}
                className="flex w-full items-center rounded-lg px-3 py-1.5 text-[13px] text-text-primary transition-colors hover:bg-bg-hover"
              >
                + {s}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---- SWITCH ----
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange?: (v: boolean) => void;
  label?: string;
  description?: string;
  disabled?: boolean;
}) {
  const { rtl } = useLanguage();
  return (
    <div className="flex items-center justify-between gap-4">
      {(label || description) && (
        <div>
          {label && <p className="text-[13px] font-medium text-text-primary">{label}</p>}
          {description && <p className="text-[12px] text-text-muted">{description}</p>}
        </div>
      )}
      <button
        type="button"
        onClick={() => !disabled && onChange?.(!checked)}
        disabled={disabled}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition-all duration-200',
          checked ? 'bg-gold' : 'bg-bg-active border border-border',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <motion.div
          layout
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm"
          animate={{ left: rtl ? (checked ? 2 : 22) : (checked ? 22 : 2) }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </button>
    </div>
  );
}

// ---- CHECKBOX ----
export function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange?: (v: boolean) => void;
  label?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5">
      <button
        type="button"
        onClick={() => onChange?.(!checked)}
        className={cn(
          'flex h-5 w-5 items-center justify-center rounded-md border transition-all duration-150',
          checked ? 'bg-gold border-gold' : 'bg-bg-elevated border-border hover:border-border-strong'
        )}
      >
        {checked && <Check className="h-3.5 w-3.5 text-[#0D0D0F]" strokeWidth={2.5} />}
      </button>
      {label && <span className="text-[13px] text-text-primary">{label}</span>}
    </label>
  );
}

// ---- DATE INPUT ----
export function DateInput({
  value,
  onChange,
  placeholder = undefined,
  disabled,
  error,
}: {
  value?: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
}) {
  const { t } = useLanguage();
  const placeholderText = placeholder ?? t('common.selectDate');
  return (
    <div className="relative">
      <input
        type="date"
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholderText}
        disabled={disabled}
        className={cn('input pe-10', error && 'input-error')}
      />
      <Calendar className="absolute right-3 rtl:left-3 rtl:right-auto top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
    </div>
  );
}

// ---- UPLOAD ----
export function UploadField({
  label = undefined,
  accept = 'image/*',
  onChange,
  preview,
}: {
  label?: string;
  accept?: string;
  onChange?: (file: File) => void;
  preview?: string;
}) {
  const { t } = useLanguage();
  const labelText = label ?? t('common.uploadFile');
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files[0]) onChange?.(e.dataTransfer.files[0]);
      }}
      onClick={() => inputRef.current?.click()}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center transition-all',
        dragging ? 'border-gold bg-gold-bg' : 'border-border hover:border-border-strong bg-bg-elevated'
      )}
    >
      {preview ? (
        <img src={preview} alt={t('common.preview')} className="mb-3 max-h-32 rounded-lg object-contain" />
      ) : (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-bg-secondary text-gold">
          <Upload className="h-5 w-5" strokeWidth={1.5} />
        </div>
      )}
      <p className="text-[13px] font-medium text-text-primary">{labelText}</p>
      <p className="mt-0.5 text-[12px] text-text-muted">{t('common.dragDrop')}</p>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={(e) => e.target.files?.[0] && onChange?.(e.target.files[0])}
        className="hidden"
      />
    </div>
  );
}

// ---- MODAL ----
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className={cn('w-full overflow-hidden rounded-2xl border border-border bg-bg-secondary shadow-modal pointer-events-auto', sizes[size])}
            >
              <div className="flex items-start justify-between border-b border-border px-6 py-5">
                <div>
                  <h2 className="font-serif text-xl font-medium text-text-primary">{title}</h2>
                  {description && <p className="mt-1 text-[13px] text-text-muted">{description}</p>}
                </div>
                <button onClick={onClose} className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-bg-elevated hover:text-text-primary">
                  <X className="h-5 w-5" strokeWidth={1.5} />
                </button>
              </div>
              <div className="scrollbar-thin max-h-[60vh] overflow-y-auto px-6 py-5">{children}</div>
              {footer && (
                <div className="flex items-center justify-end gap-2.5 border-t border-border px-6 py-4">
                  {footer}
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

// ---- LOADING BUTTON ----
export function LoadingButton({
  children,
  onClick,
  loading,
  disabled,
  variant = 'gold',
  size = 'md',
  type = 'button',
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'gold' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  type?: 'button' | 'submit';
  className?: string;
}) {
  const variants = {
    gold: 'btn-gold',
    outline: 'btn-outline',
    ghost: 'btn-ghost',
    danger: 'btn-danger',
  };
  const sizes = { sm: 'btn-sm', md: 'btn-md', lg: 'btn-lg' };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn('btn', variants[variant], sizes[size], className)}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

// ---- SEARCH INPUT ----
export function SearchInput({
  value,
  onChange,
  placeholder = undefined,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const { t } = useLanguage();
  const placeholderText = placeholder ?? t('common.searchPrompt');
  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-3 rtl:right-3 rtl:left-auto top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" strokeWidth={1.5} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholderText}
        className="input ps-10"
      />
    </div>
  );
}
