/** Petits composants de l'ERP (zone claire) : cartes, tuiles KPI, champs, tableaux */
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-semibold text-ink">{title}</h1>
        {subtitle && <p className="text-sm text-[#52525b]">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
    </div>
  )
}

export function Card({ title, actions, children, className }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('flex flex-col gap-4 rounded-2xl border border-[#e4e4e7] bg-white p-5', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-[17px] font-semibold text-ink">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  )
}

export function Kpi({ label, value, hint, tone = 'neutral' }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'neutral' | 'good' | 'warn' }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-[#e4e4e7] bg-white p-5">
      <span className="text-[13px] font-medium text-[#52525b]">{label}</span>
      <strong className="text-[28px] leading-tight font-semibold text-ink">{value}</strong>
      {hint && <span className={cn('text-[13px] font-medium', tone === 'good' ? 'text-[#14532d]' : tone === 'warn' ? 'text-gold-text' : 'text-[#52525b]')}>{hint}</span>}
    </div>
  )
}

const fieldClass = 'min-h-11 w-full rounded-[10px] border border-[#a1a1aa] bg-white px-3 text-[15px] text-ink aria-[invalid=true]:border-2 aria-[invalid=true]:border-[#b91c1c]'

export const AdminInput = ({ className, ...p }: ComponentProps<'input'>) => <input className={cn(fieldClass, className)} {...p} />
export const AdminSelect = ({ className, ...p }: ComponentProps<'select'>) => <select className={cn(fieldClass, className)} {...p} />

export function AdminField({ label, error, children, htmlFor }: { label: string; error?: string; children: ReactNode; htmlFor: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink">{label}</label>
      {children}
      {error && <p role="alert" className="text-sm font-medium text-[#b91c1c]">{error}</p>}
    </div>
  )
}

/** Tableau : défile horizontalement sur mobile au lieu de casser la page */
export function Table({ head, children, minWidth = 640 }: { head: string[]; children: ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm text-ink" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-[#e4e4e7] text-left text-xs text-[#52525b]">
            {head.map((h, i) => <th key={i} scope="col" className="px-2 py-2.5 font-semibold">{h}</th>)}
          </tr>
        </thead>
        <tbody className="[&_tr]:border-b [&_tr]:border-[#f4f4f5] [&_td]:px-2 [&_td]:py-3">{children}</tbody>
      </table>
    </div>
  )
}

export function Feedback({ kind, children }: { kind: 'error' | 'success'; children: ReactNode }) {
  return (
    <p role={kind === 'error' ? 'alert' : 'status'} className={cn('rounded-xl px-4 py-3 text-sm font-medium', kind === 'error' ? 'bg-[#fde2e2] text-[#7f1d1d]' : 'bg-[#dff3e4] text-[#14532d]')}>
      {children}
    </p>
  )
}

export const dateTime = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).format(new Date(`${iso.slice(0, 19)}Z`)) : '—'
