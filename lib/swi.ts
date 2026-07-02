export type RiskLevel = "low" | "moderate" | "critical"

export interface SwiInputs {
  /** Temperatura de superficie del mar/lago (°C) */
  sst: number
  /** Temperatura a 850 hPa (°C) */
  t850: number
  /** Velocidad del viento (km/h) */
  wind: number
}

export interface RiskResult {
  /** Índice 0 - 100 */
  score: number
  level: RiskLevel
  /** Gradiente térmico vertical (inestabilidad) */
  instability: number
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

/**
 * Modelo simplificado del Índice de Trombas Marinas (Spout/Severe Weather Index).
 * Combina la inestabilidad térmica vertical (SST - T850) con la cizalladura
 * representada por la velocidad del viento. Es una aproximación didáctica,
 * no un pronóstico operativo.
 */
export function computeRisk({ sst, t850, wind }: SwiInputs): RiskResult {
  const instability = sst - t850
  // La convección profunda requiere fuerte gradiente térmico.
  const instabilityScore = clamp((instability / 30) * 100, 0, 100)
  const windScore = clamp((wind / 80) * 100, 0, 100)

  // El gradiente térmico pesa más que el viento.
  const score = Math.round(clamp(instabilityScore * 0.65 + windScore * 0.35, 0, 100))

  let level: RiskLevel = "low"
  if (score >= 70) level = "critical"
  else if (score >= 40) level = "moderate"

  return { score, level, instability: Math.round(instability * 10) / 10 }
}

export const RISK_META: Record<
  RiskLevel,
  { label: string; description: string; token: string }
> = {
  low: {
    label: "BAJO",
    description: "Atmósfera estable. Sin condiciones para formación de trombas.",
    token: "var(--risk-low)",
  },
  moderate: {
    label: "MODERADO",
    description: "Inestabilidad creciente. Vigilancia recomendada en la zona de convergencia.",
    token: "var(--risk-mid)",
  },
  critical: {
    label: "CRÍTICO",
    description: "Condiciones favorables para trombas marinas. Alerta activa.",
    token: "var(--risk-high)",
  },
}
