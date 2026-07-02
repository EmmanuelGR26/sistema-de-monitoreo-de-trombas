"use client"

import { useEffect, useMemo } from "react"
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import type { RiskResult } from "@/lib/swi"
import { RISK_META } from "@/lib/swi"

const CHAPALA: [number, number] = [20.25, -103.2]

/** Corrige el tamaño del mapa cuando el contenedor flex termina de dimensionarse. */
function ResizeFix() {
  const map = useMap()
  useEffect(() => {
    const fix = () => {
      map.invalidateSize()
      map.setView(CHAPALA, 11, { animate: false })
    }
    // Varios reintentos para cubrir el montaje del layout flex.
    const timers = [0, 200, 500, 900].map((d) => setTimeout(fix, d))
    window.addEventListener("resize", fix)

    return () => {
      timers.forEach(clearTimeout)
      window.removeEventListener("resize", fix)
    }
  }, [map])
  return null
}

function buildIcon(level: "BAJO" | "MODERADO" | "ALTO", color: string) {
  let duration = "2.5s"
  let size = 22
  
  if (level === "MODERADO") {
    duration = "1.2s"
    size = 28
  } else if (level === "ALTO") {
    duration = "0.5s"
    size = 38
  }

  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2 - 4],
    html: `
      <style>
        @keyframes pulseMarkerRisk {
          0% { transform: scale(0.85); }
          50% { transform: scale(1.15); }
          100% { transform: scale(0.85); }
        }
      </style>
      <span style="
        display:flex;align-items:center;justify-content:center;
        width:100%;height:100%;border-radius:50%;
        background:${color};
        box-shadow:0 0 0 4px color-mix(in oklch, ${color} 40%, transparent),
                   0 0 16px ${color};
        border:2px solid #0a0f1a;
        animation: pulseMarkerRisk ${duration} ease-in-out infinite;
        transition: all 0.3s ease;
      "></span>`,
  })
}

function SimulatedWindLayer({ score, level }: { score: number, level: "BAJO" | "MODERADO" | "ALTO" }) {
  const points = useMemo(() => {
    const pts = []
    for (let i = 0; i < 45; i++) {
      const angle = (i * 137.5) * (Math.PI / 180) 
      const r = 0.01 + (i % 6) * 0.012 
      pts.push({
        lat: CHAPALA[0] + r * Math.cos(angle),
        lng: CHAPALA[1] + r * Math.sin(angle),
        baseOpacity: 0.05 + (i % 3) * 0.05
      })
    }
    return pts
  }, [])

  const intensity = Math.max(0.2, score / 100)
  const color = RISK_META[level].token

  return (
    <>
      {points.map((p, i) => (
        <Circle
          key={i}
          center={[p.lat, p.lng]}
          radius={600 + intensity * 1000 + (i % 4) * 300}
          pathOptions={{
            color: "transparent",
            fillColor: color,
            fillOpacity: p.baseOpacity * intensity * 1.5,
          }}
        />
      ))}
    </>
  )
}

export default function MapView({
  result,
  timeLabel,
}: {
  result: RiskResult
  timeLabel?: string
}) {
  const color = RISK_META[result.level].token
  // radio de la zona de convergencia crece con el riesgo
  const radius = 1500 + result.score * 35
  
  // Memoizar el icono es CRÍTICO para que Leaflet no destruya y recree
  // el elemento DOM del marcador 60 veces por segundo al mover el slider.
  const memoizedIcon = useMemo(() => buildIcon(result.level, color), [result.level, color])

  return (
    <MapContainer
      center={CHAPALA}
      zoom={11}
      scrollWheelZoom
      style={{ height: "100%", width: "100%" }}
      zoomControl
    >
      <ResizeFix />
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />

      <Circle
        center={CHAPALA}
        radius={radius}
        pathOptions={{
          color,
          fillColor: color,
          fillOpacity: 0.12,
          weight: 1.5,
          dashArray: "6 6",
        }}
      />
      
      {/* Capa de Convergencia Simulada (estilo Heatmap) */}
      <SimulatedWindLayer score={result.score} level={result.level} />

      <Marker position={CHAPALA} icon={memoizedIcon}>
        <Popup>
          <strong style={{ letterSpacing: "0.05em" }}>ZONA DE CONVERGENCIA</strong>
          <br />
          Lat 20.25 · Lon -103.20
          <br />
          Índice SWI: {result.score}/100
          {timeLabel ? (
            <>
              <br />
              {timeLabel}
            </>
          ) : null}
        </Popup>
      </Marker>
    </MapContainer>
  )
}
