"use client"

import { AlertTriangle, ShieldCheck, ShieldAlert } from "lucide-react"
import { RISK_META, type RiskResult } from "@/lib/swi"

const ICONS = {
  low: ShieldCheck,
  moderate: ShieldAlert,
  critical: AlertTriangle,
} as const

export function RiskCard({ result }: { result: RiskResult }) {
  const meta = RISK_META[result.level]
  const Icon = ICONS[result.level]
  const isCritical = result.level === "critical"

  return (
    <div
      className={`relative overflow-hidden rounded-xl border p-5 transition-colors duration-500 ${
        isCritical ? "animate-radar-pulse" : ""
      }`}
      style={{
        borderColor: `color-mix(in oklch, ${meta.token} 55%, transparent)`,
        backgroundColor: `color-mix(in oklch, ${meta.token} 12%, var(--card))`,
      }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Índice de Riesgo
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className="font-mono text-4xl font-bold leading-none tabular-nums"
              style={{ color: meta.token }}
            >
              {result.score}
            </span>
            <span className="text-sm text-muted-foreground">/ 100</span>
          </div>
        </div>

        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
          style={{
            backgroundColor: `color-mix(in oklch, ${meta.token} 20%, transparent)`,
            color: meta.token,
          }}
        >
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <span
          className="inline-flex items-center rounded-md px-2 py-0.5 font-mono text-xs font-semibold uppercase tracking-wider"
          style={{
            backgroundColor: `color-mix(in oklch, ${meta.token} 22%, transparent)`,
            color: meta.token,
          }}
        >
          {meta.label}
        </span>
      </div>

      <p className="mt-3 text-pretty text-xs leading-relaxed text-muted-foreground">
        {meta.description}
      </p>

      {/* Barra de progreso del índice */}
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${result.score}%`, backgroundColor: meta.token }}
        />
      </div>
    </div>
  )
}
