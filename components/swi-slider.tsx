"use client"

import type { LucideIcon } from "lucide-react"

interface SwiSliderProps {
  icon: LucideIcon
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit: string
  accent?: string
  onChange: (value: number) => void
}

export function SwiSlider({
  icon: Icon,
  label,
  value,
  min,
  max,
  step = 0.1,
  unit,
  accent = "var(--primary)",
  onChange,
}: SwiSliderProps) {
  const pct = ((value - min) / (max - min)) * 100

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" style={{ color: accent }} aria-hidden="true" />
          <span className="text-sm font-medium text-foreground">{label}</span>
        </div>
        <span className="font-mono text-sm tabular-nums text-foreground">
          {value.toFixed(step < 1 ? 1 : 0)}
          <span className="ml-1 text-xs text-muted-foreground">{unit}</span>
        </span>
      </div>

      <input
        type="range"
        className="swi-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number.parseFloat(e.target.value))}
        aria-label={label}
        style={
          {
            "--thumb-color": accent,
            background: `linear-gradient(to right, ${accent} ${pct}%, var(--secondary) ${pct}%)`,
          } as React.CSSProperties
        }
      />

      <div className="flex justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>
          {min}
          {unit}
        </span>
        <span>
          {max}
          {unit}
        </span>
      </div>
    </div>
  )
}
