"use client"

import { useEffect, useState } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"
import { AlertCircle, History } from "lucide-react"

interface HistorialEvent {
  fecha: string
  ciudad: string
  latitud: number
  longitud: number
  swi: number
  clima_descripcion: string
}

export function HistoricalChart() {
  const [data, setData] = useState<HistorialEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/historial.json?t=" + new Date().getTime())
        if (!res.ok) {
          if (res.status === 404) {
            setData([])
          } else {
            setError(true)
          }
          return
        }
        const json = await res.json()
        
        // Formatear datos para la gráfica (ordenar cronológicamente si es necesario)
        if (Array.isArray(json)) {
          setData(json)
        }
      } catch (e) {
        // Puede que no exista aún
        setData([])
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return <div className="h-48 w-full flex items-center justify-center text-muted-foreground text-sm">Cargando bitácora...</div>
  }

  if (error || data.length === 0) {
    return (
      <div className="h-48 w-full flex flex-col items-center justify-center text-muted-foreground bg-zinc-950/20 rounded-lg border border-dashed border-border/50">
        <History className="h-8 w-8 mb-2 opacity-20" />
        <span className="text-sm font-medium">Historial Limpio</span>
        <span className="text-xs opacity-70">No se han registrado picos críticos (SWI &gt; 75) recientemente.</span>
      </div>
    )
  }

  // Custom Tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-lg shadow-xl text-zinc-300 text-xs">
          <p className="font-semibold text-zinc-100 mb-1">{new Date(data.fecha).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</p>
          <p><span className="text-emerald-500 font-bold">SWI:</span> {data.swi.toFixed(1)} (CRÍTICO)</p>
          <p><span className="text-zinc-500">Zona:</span> {data.ciudad}</p>
          <p><span className="text-zinc-500">Clima:</span> {data.clima_descripcion}</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4 px-1">
        <History className="h-4 w-4 text-emerald-500" />
        <h3 className="text-sm font-medium text-zinc-200">Análisis Histórico de Inestabilidad</h3>
      </div>
      <div className="flex-1 min-h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis 
              dataKey="fecha" 
              stroke="#52525b" 
              fontSize={10}
              tickFormatter={(val) => new Date(val).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
              minTickGap={30}
            />
            <YAxis 
              domain={[75, 100]} 
              stroke="#52525b" 
              fontSize={10} 
              tickCount={6}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={75} stroke="#ef4444" strokeDasharray="3 3" opacity={0.3} />
            <Line 
              type="monotone" 
              dataKey="swi" 
              stroke="#10b981" 
              strokeWidth={2}
              dot={{ r: 3, fill: "#10b981", strokeWidth: 0 }}
              activeDot={{ r: 5, fill: "#10b981", stroke: "#047857", strokeWidth: 2 }}
              animationDuration={1500}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
