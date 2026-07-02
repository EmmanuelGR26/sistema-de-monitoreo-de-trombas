"use client"

import { Radar, Thermometer, CloudSnow, Wind, Activity } from "lucide-react"
import { SwiSlider } from "@/components/swi-slider"
import { RiskCard } from "@/components/risk-card"
import { computeRisk, type SwiInputs } from "@/lib/swi"

interface ControlPanelProps {
  inputs: SwiInputs
  onChange: (next: Partial<SwiInputs>) => void
}

export function ControlPanel({ inputs, onChange }: ControlPanelProps) {
  const result = computeRisk(inputs)

  return (
    <aside className="grid-overlay flex h-full flex-col gap-6 overflow-y-auto border-r border-border bg-sidebar p-5 lg:w-[360px]">
      {/* Encabezado */}
      <header className="flex items-start gap-3">
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Radar className="h-6 w-6 animate-sweep" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-pretty text-base font-semibold leading-tight text-foreground">
            Monitor SWI
          </h1>
          <p className="text-sm text-primary">Lago de Chapala</p>
        </div>
      </header>

      <div className="flex items-center gap-2 rounded-md border border-border bg-card/50 px-3 py-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
          Telemetría en vivo · Convección
        </p>
      </div>

      {/* Controles */}
      <section className="space-y-6">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <h2 className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
            Parámetros atmosféricos
          </h2>
        </div>

        <SwiSlider
          icon={Thermometer}
          label="Temperatura de Superficie (SST)"
          value={inputs.sst}
          min={15}
          max={35}
          unit="°C"
          accent="var(--chart-2)"
          onChange={(v) => onChange({ sst: v })}
        />

        <SwiSlider
          icon={CloudSnow}
          label="Temperatura a 850 hPa (T850)"
          value={inputs.t850}
          min={-5}
          max={25}
          unit="°C"
          accent="var(--primary)"
          onChange={(v) => onChange({ t850: v })}
        />

        <SwiSlider
          icon={Wind}
          label="Velocidad del Viento"
          value={inputs.wind}
          min={0}
          max={80}
          step={1}
          unit=" km/h"
          accent="var(--chart-5)"
          onChange={(v) => onChange({ wind: v })}
        />
      </section>

      {/* Índice de riesgo */}
      <RiskCard result={result} />

      <footer className="mt-auto border-t border-border pt-4">
        <p className="text-pretty text-[10px] leading-relaxed text-muted-foreground">
          Gradiente térmico vertical:{" "}
          <span className="font-mono text-foreground">{result.instability} °C</span>. Modelo
          didáctico de inestabilidad convectiva (SST − T850).
        </p>
      </footer>
    </aside>
  )
}
