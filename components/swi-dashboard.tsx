"use client"

import { useMemo, useState, useEffect, useRef } from "react"
import dynamic from "next/dynamic"
import { Loader2, Layers, Calendar, Clock } from "lucide-react"
import { ControlPanel } from "@/components/control-panel"
import { computeRisk, RISK_META, type SwiInputs } from "@/lib/swi"
import { type PronosticoHora } from "@/lib/mock-data"

const MapView = dynamic(() => import("@/components/map-view"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-card text-muted-foreground">
      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
      <span className="font-mono text-xs uppercase tracking-widest">Inicializando mapa…</span>
    </div>
  ),
})

function formatDate(isoString?: string) {
  if (!isoString) return 'Cargando...';
  try {
    const d = new Date(isoString.replace('T', ' '));
    if (isNaN(d.getTime())) return isoString;

    return d.toLocaleString('es-MX', {
      weekday: 'short', day: 'numeric', month: 'short',
      hour: 'numeric', minute: '2-digit', hour12: true
    });
  } catch (e) {
    return isoString;
  }
}

function TimeSlider({ data, initialIndex, onChange, onGoLive }: { data: PronosticoHora[], initialIndex: number, onChange: (idx: number) => void, onGoLive: () => void }) {
  const [local, setLocal] = useState(initialIndex);

  useEffect(() => { setLocal(initialIndex) }, [initialIndex]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = parseInt(e.target.value, 10);
    if (isNaN(newVal)) return;
    setLocal(newVal);
    onChange(newVal);
  };

  const safeLocal = Math.max(0, Math.min(local, data.length - 1));
  const localCurrentData = data.length > 0 ? data[safeLocal] : null;

  const dayMarks = useMemo(() => {
    const marks: { index: number, label: string }[] = [];
    let lastDay = "";
    data.forEach((d, i) => {
      try {
        const dateObj = new Date(d.hora_local.replace('T', ' '));
        if (!isNaN(dateObj.getTime())) {
          const dayStr = dateObj.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' });
          if (dayStr !== lastDay) {
            marks.push({ index: i, label: dayStr });
            lastDay = dayStr;
          }
        }
      } catch (e) { }
    });
    return marks;
  }, [data]);

  const maxVal = data.length > 0 ? data.length - 1 : 167;
  const percentage = maxVal > 0 ? (local / maxVal) * 100 : 0;

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6 pt-4">
      <div className="relative w-full">
        {dayMarks.map((mark) => (
          <div
            key={mark.index}
            className="absolute -top-6 text-[10px] font-semibold text-muted-foreground border-l-2 border-primary/40 pl-1.5 capitalize"
            style={{ left: `${(mark.index / Math.max(1, maxVal)) * 100}%` }}
          >
            {mark.label}
          </div>
        ))}
        <input 
          type="range" 
          min="0" 
          max={maxVal} 
          step="1" 
          value={local} 
          onChange={handleSliderChange}
          style={{
            backgroundImage: `linear-gradient(to right, currentColor ${percentage}%, transparent ${percentage}%)`
          }}
          className="w-full h-2 bg-muted text-primary rounded-lg appearance-none cursor-pointer accent-primary relative z-10"
        />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground mt-1 px-1">
        <span>Hora seleccionada: <span className="font-medium text-foreground">{formatDate(localCurrentData?.hora_local)}</span></span>
        <button 
          onClick={onGoLive}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-muted hover:text-foreground transition-colors"
          title="Regresar a la hora actual"
        >
          <Clock className="w-3.5 h-3.5" />
          <span className="font-medium">Ahora</span>
        </button>
      </div>
    </div>
  );
}

export default function SwiDashboard() {
  const [data, setData] = useState<PronosticoHora[]>([])
  const [timeIndex, setTimeIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [lastFetchTime, setLastFetchTime] = useState<number | null>(null);
  
  const selectedHourRef = useRef<string | null>(null);

  useEffect(() => {
    if (data.length > 0 && timeIndex >= 0 && timeIndex < data.length) {
      selectedHourRef.current = data[timeIndex].hora_local;
    }
  }, [timeIndex, data]);

  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async (isInitial = false) => {
      try {
        const response = await fetch(`/pronostico.json?t=${Date.now()}`);
        if (!response.ok) throw new Error('No se encontró pronostico.json');
        const jsonData = await response.json();
        
        if (!isMounted) return;

        setData(jsonData);
        setLastFetchTime(Date.now());

        if (isInitial) {
          const now = Date.now();
          let currentIdx = 0;
          for (let i = 0; i < jsonData.length; i++) {
            const dateObj = new Date(jsonData[i].hora_local.replace('T', ' '));
            if (dateObj.getTime() <= now) {
              currentIdx = i;
            } else {
              break;
            }
          }
          setTimeIndex(currentIdx);
        } else if (selectedHourRef.current) {
          const foundIdx = jsonData.findIndex((d: any) => d.hora_local === selectedHourRef.current);
          if (foundIdx !== -1) {
            setTimeIndex(foundIdx);
          } else {
            const now = Date.now();
            let currentIdx = 0;
            for (let i = 0; i < jsonData.length; i++) {
              const dateObj = new Date(jsonData[i].hora_local.replace('T', ' '));
              if (dateObj.getTime() <= now) {
                currentIdx = i;
              } else {
                break;
              }
            }
            setTimeIndex(currentIdx);
          }
        }
      } catch (error) {
        console.error("Error cargando JSON:", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchData(true);

    const interval = setInterval(() => {
      fetchData(false);
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleGoLive = () => {
    if (data.length === 0) return;
    const now = Date.now();
    let currentIdx = 0;
    for (let i = 0; i < data.length; i++) {
      const dateObj = new Date(data[i].hora_local.replace('T', ' '));
      if (dateObj.getTime() <= now) {
        currentIdx = i;
      } else {
        break;
      }
    }
    setTimeIndex(currentIdx);
  };

  const safeTimeIndex = typeof timeIndex === 'number' && !isNaN(timeIndex)
    ? Math.max(0, Math.min(timeIndex, data.length - 1))
    : 0;
  const currentData = data.length > 0 ? data[safeTimeIndex] : null;

  const sst = currentData?.sst_lago_c ?? 28;
  const t850 = currentData?.t850_c ?? 12;
  const wind = currentData?.wind_speed_10m ?? 35;

  const inputs: SwiInputs = useMemo(() => ({ sst, t850, wind }), [sst, t850, wind]);
  const result = useMemo(() => computeRisk(inputs), [inputs]);
  const meta = RISK_META[result.level as keyof typeof RISK_META] || RISK_META.low;

  const memoizedMap = useMemo(() => <MapView result={result} />, [result]);

  if (isLoading || !currentData) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        <span className="font-mono text-xs uppercase tracking-widest">Cargando pronóstico...</span>
      </div>
    )
  }

  return (
    <main className="flex h-dvh flex-col overflow-hidden lg:flex-row">
      <ControlPanel inputs={inputs} onChange={() => { }} />
      <section className="relative flex-1 flex flex-col">
        <div className="flex-1 relative">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex items-center justify-between gap-2 p-3">
            <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-border bg-card/80 px-3 py-2 backdrop-blur">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="font-mono text-xs tabular-nums text-foreground capitalize">
                {formatDate(currentData.hora_local)}
              </span>
            </div>
            
            <div className="flex gap-2">
              {lastFetchTime && (
                <div className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-border bg-card/80 px-3 py-2 backdrop-blur">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                    Actualizado: {new Date(lastFetchTime).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              )}
              <div className="pointer-events-auto flex items-center gap-2 rounded-lg border bg-card/80 px-3 py-2 backdrop-blur" style={{ borderColor: `color-mix(in oklch, ${meta.token} 50%, transparent)` }}>
                <Layers className="h-4 w-4" style={{ color: meta.token }} />
                <span className="font-mono text-xs font-semibold uppercase" style={{ color: meta.token }}>
                  Alerta {meta.label}
                </span>
              </div>
            </div>
          </div>
          <div className="h-full w-full">
            {memoizedMap}
          </div>
        </div>
        <div className="p-6 bg-card border-t z-[1001] shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
          <TimeSlider data={data} initialIndex={timeIndex} onChange={setTimeIndex} onGoLive={handleGoLive} />
        </div>
      </section>
    </main>
  )
}