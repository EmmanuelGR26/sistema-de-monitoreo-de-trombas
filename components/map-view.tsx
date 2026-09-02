"use client"

import { useEffect, useMemo } from "react"
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import type { RiskResult, RiskLevel } from "@/lib/swi"
import { RISK_META } from "@/lib/swi"

export type CityMapData = {
  city: string;
  coords: [number, number];
  result: RiskResult;
  inputs: { sst: number, t850: number, wind: number };
  isSelected: boolean;
};

const LAKE_CENTER: [number, number] = [20.25, -103.2];

/** Corrige el tamaño del mapa cuando el contenedor flex termina de dimensionarse. */
function ResizeFix() {
  const map = useMap()
  useEffect(() => {
    const fix = () => {
      map.invalidateSize()
      map.setView(LAKE_CENTER, 11, { animate: false })
    }
    const timers = [0, 200, 500, 900].map((d) => setTimeout(fix, d))
    window.addEventListener("resize", fix)

    return () => {
      timers.forEach(clearTimeout)
      window.removeEventListener("resize", fix)
    }
  }, [map])
  return null
}

function buildIcon(level: RiskLevel, color: string) {
  let duration = "2.5s"
  let size = 22
  
  if (level === "moderate") {
    duration = "1.2s"
    size = 28
  } else if (level === "high") {
    duration = "0.8s"
    size = 32
  } else if (level === "critical") {
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

function SimulatedWindLayer({ score, level, coords }: { score: number, level: RiskLevel, coords: [number, number] }) {
  const points = useMemo(() => {
    const pts = []
    for (let i = 0; i < 45; i++) {
      const angle = (i * 137.5) * (Math.PI / 180) 
      const r = 0.01 + (i % 6) * 0.012 
      pts.push({
        lat: coords[0] + r * Math.cos(angle),
        lng: coords[1] + r * Math.sin(angle),
        baseOpacity: 0.05 + (i % 3) * 0.05
      })
    }
    return pts
  }, [coords])

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
            interactive: false
          }}
        />
      ))}
    </>
  )
}

export default function MapView({
  cities,
}: {
  cities: CityMapData[]
}) {
  return (
    <MapContainer
      center={LAKE_CENTER}
      zoom={11}
      scrollWheelZoom
      style={{ height: "100%", width: "100%", background: "#0a0f1a" }}
      zoomControl
    >
      <ResizeFix />
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
        attribution='&copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, DeLorme, NAVTEQ'
      />

      {cities.map((cityData) => {
        const color = RISK_META[cityData.result.level].token;
        const radius = 1500 + cityData.result.score * 35;
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const memoizedIcon = useMemo(() => buildIcon(cityData.result.level, color), [cityData.result.level, color]);
        
        return (
          <div key={cityData.city}>
            <Circle
              center={cityData.coords}
              radius={radius}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.08,
                weight: 1.5,
                dashArray: "6 6",
              }}
            />
            
            <SimulatedWindLayer score={cityData.result.score} level={cityData.result.level} coords={cityData.coords} />

            <Marker position={cityData.coords} icon={memoizedIcon}>
              <Popup className="custom-popup">
                <div className="text-center font-sans min-w-[140px] bg-white text-zinc-900 rounded-md p-1">
                  <strong style={{ letterSpacing: "0.05em", fontSize: "11px", opacity: 0.7, color: "#52525b" }}>ZONA DE CONVERGENCIA</strong>
                  <br />
                  <span className="font-bold text-sm text-zinc-900">{cityData.city}</span>
                  <div className="my-1.5 border-t border-zinc-200"></div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-left text-[11px] text-zinc-600">
                    <span>Temp. Aire:</span> <strong className="text-zinc-900">{cityData.inputs.t850.toFixed(1)}°C</strong>
                    <span>Temp. Agua:</span> <strong className="text-zinc-900">{cityData.inputs.sst.toFixed(1)}°C</strong>
                    <span>Viento:</span> <strong className="text-zinc-900">{cityData.inputs.wind.toFixed(1)} km/h</strong>
                  </div>
                  <div className="mt-1.5 border-t border-zinc-200 pt-1.5">
                    Índice SWI: <strong className="text-zinc-900 text-xs">{cityData.result.score}/100</strong>
                  </div>
                  <div className="mt-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase shadow-sm" style={{ backgroundColor: color, color: '#000' }}>
                    {RISK_META[cityData.result.level].label}
                  </div>
                </div>
              </Popup>
            </Marker>
          </div>
        );
      })}
    </MapContainer>
  )
}
