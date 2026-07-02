"use client"

import { useMemo, useState, useEffect, useRef } from "react"
import dynamic from "next/dynamic"
import { Loader2, Layers, Calendar, Clock, AlertTriangle, ShieldAlert, CloudLightning, RadioTower, ExternalLink } from "lucide-react"
import { computeRisk, RISK_META } from "@/lib/swi"
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

  const maxVal = data.length > 0 ? data.length - 1 : 71;
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

function PremiumTwitterCard({ handle, title, description, link }: { handle: string, title: string, description: string, link: string }) {
  return (
    <div className="flex flex-col h-full items-center justify-center p-6 text-center space-y-3 bg-zinc-900/50 rounded-xl border border-border/80 shadow-inner relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
      <div className="p-3 bg-black rounded-full shadow-lg border border-zinc-800 relative z-10">
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" aria-hidden="true">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      </div>
      <div className="relative z-10">
        <h4 className="font-semibold text-foreground text-sm">{title}</h4>
        <p className="text-xs text-muted-foreground mt-1 mb-4">{description}</p>
        <a 
          href={link}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-zinc-200 text-black text-xs font-bold rounded-full transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:scale-105"
        >
          Ver X Oficial
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

const CIUDADES_COORDS: Record<string, [number, number]> = {
    "Oeste (Jocotepec)": [20.270, -103.350],
    "Oeste (S.J. Cosalá)": [20.260, -103.300],
    "Oeste-Centro (Ajijic)": [20.270, -103.250],
    "Oeste-Centro (Ajijic Profundo)": [20.240, -103.250],
    "San Cristóbal": [20.2368, -103.3603],
    "Norte (Chapala)": [20.270, -103.180],
    "Centro (Norte Chapala Profundo)": [20.250, -103.150],
    "Isla de Mezcala": [20.290, -103.023],
    "Mezcala": [20.245, -103.030],
    "Mezcala Profundo": [20.220, -103.080],
    "San Pedro Iztacán": [20.290, -102.955],
    "Jamay": [20.280, -102.750],
    "Ocotlán": [20.290, -102.730],
    "Jamay Frente": [20.260, -102.800],
    "Centro-Este": [20.250, -102.900],
    "Tuxcueca": [20.200, -103.180],
    "San Luis Soyatlán": [20.2167, -103.2958],
    "Tizapán": [20.190, -103.050],
    "Cojumatlán": [20.150, -102.830],
    "Lago Profundo": [20.180, -102.950]
};

export default function SwiDashboard() {
  const [fullData, setFullData] = useState<Record<string, PronosticoHora[]>>({})
  const [timeIndex, setTimeIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [lastFetchTime, setLastFetchTime] = useState<number | null>(null);
  
  // Nowcasting Modal State
  const [showReportModal, setShowReportModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Extraemos la lista de datos del primer punto (solo para el control del tiempo)
  const firstCityKey = Object.keys(CIUDADES_COORDS)[0];
  const data = fullData[firstCityKey] || [];
  
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

        setFullData(jsonData);
        setLastFetchTime(Date.now());
        
        const firstCityData = jsonData[Object.keys(jsonData)[0]] || [];

        if (isInitial && firstCityData.length > 0) {
          const now = Date.now();
          let currentIdx = 0;
          for (let i = 0; i < firstCityData.length; i++) {
            const dateObj = new Date(firstCityData[i].hora_local.replace('T', ' '));
            if (dateObj.getTime() <= now) {
              currentIdx = i;
            } else {
              break;
            }
          }
          setTimeIndex(currentIdx);
        } else if (selectedHourRef.current && firstCityData.length > 0) {
          const foundIdx = firstCityData.findIndex((d: any) => d.hora_local === selectedHourRef.current);
          if (foundIdx !== -1) {
            setTimeIndex(foundIdx);
          } else {
            const now = Date.now();
            let currentIdx = 0;
            for (let i = 0; i < firstCityData.length; i++) {
              const dateObj = new Date(firstCityData[i].hora_local.replace('T', ' '));
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

  // Calculamos los riesgos para todas las ciudades
  const mapData = useMemo(() => {
    const list = Object.keys(CIUDADES_COORDS).map(city => {
      const cityDataList = fullData[city] || [];
      const cData = cityDataList.length > 0 ? cityDataList[safeTimeIndex] : null;
      
      const cityInputs = {
        sst: cData?.sst_lago_c ?? 28,
        t850: cData?.t850_c ?? 12,
        wind: cData?.wind_speed_10m ?? 35,
      };
      
      return {
        city,
        coords: CIUDADES_COORDS[city],
        result: computeRisk(cityInputs),
        inputs: cityInputs,
        isSelected: false
      };
    });
    
    // Ordenar: crítico/alto primero
    list.sort((a, b) => {
       const riskOrder = { 'critical': 4, 'high': 3, 'moderate': 2, 'low': 1 };
       const scoreDiff = riskOrder[b.result.level] - riskOrder[a.result.level];
       if (scoreDiff !== 0) return scoreDiff;
       return b.result.score - a.result.score; // Romper empate con el score numérico
    });
    
    return list;
  }, [fullData, safeTimeIndex]);

  const memoizedMap = useMemo(() => <MapView cities={mapData} />, [mapData]);

  if (isLoading || !currentData) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        <span className="font-mono text-xs uppercase tracking-widest">Cargando pronóstico...</span>
      </div>
    )
  }

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.target as HTMLFormElement);
    const sector = formData.get("sector");
    const dangerLevel = formData.get("dangerLevel");
    const description = formData.get("description");

    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sector, dangerLevel, description })
      });
      if (res.ok) {
        alert("¡Reporte enviado exitosamente! Gracias por tu colaboración.");
        setShowReportModal(false);
      } else {
        alert("Error al enviar el reporte. Intenta nuevamente.");
      }
    } catch (err) {
      alert("Error de conexión.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Identificar el nivel máximo de riesgo actual en el lago
  const maxRisk = mapData.length > 0 ? mapData[0].result : { level: 'low', score: 0 };
  const globalMeta = RISK_META[maxRisk.level as keyof typeof RISK_META] || RISK_META.low;

  return (
    <>
    <main className="flex h-dvh flex-col overflow-hidden lg:flex-row">
      
      {/* 1. PANEL IZQUIERDO: FUENTES OFICIALES */}
      <aside className="w-full lg:w-80 flex flex-col bg-card/95 border-r border-border backdrop-blur z-[1001] h-[30vh] lg:h-full overflow-hidden shrink-0">
        
        {/* ENCABEZADO RADAR CHAPALA */}
        <div className="p-5 border-b border-border bg-zinc-900/30 flex items-center gap-4 shrink-0">
          <div className="relative w-10 h-10 rounded-full border border-emerald-500/30 bg-emerald-950/10 flex items-center justify-center overflow-hidden shrink-0">
            {/* Anillos concéntricos del radar */}
            <div className="absolute w-8 h-8 rounded-full border border-emerald-500/20"></div>
            <div className="absolute w-4 h-4 rounded-full border border-emerald-500/10"></div>
            {/* Haz de luz giratorio (Barrido del radar) */}
            <div className="absolute inset-0 bg-[conic-gradient(from_0deg,transparent_60%,rgba(16,185,129,0.4)_100%)] rounded-full animate-[spin_3.5s_linear_infinite]"></div>
            {/* Punto central del radar parpadeante */}
            <div className="relative w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,1)] animate-pulse"></div>
          </div>
          <div className="flex flex-col">
            <h1 className="font-mono text-lg font-bold tracking-wider text-emerald-400 leading-none">RADAR CHAPALA</h1>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-1.5">Monitoreo de Trombas</span>
          </div>
        </div>

        {/* BOTON REPORTE CIUDADANO (DESTACADO) */}
        <div className="p-4 border-b border-border bg-card/50">
          <button 
            onClick={() => setShowReportModal(true)}
            className="w-full relative group overflow-hidden rounded-xl bg-red-500/10 border border-red-500/30 p-4 transition-all hover:bg-red-500/20 shadow-sm"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <div className="flex items-center gap-3 relative z-10">
              <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-red-500/20 text-red-500 animate-pulse text-lg">
                ⚠️
              </div>
              <div className="text-left flex-1">
                <h3 className="font-bold text-red-500 text-sm">Reportar Avistamiento</h3>
                <p className="text-xs text-red-500/80 font-medium mt-0.5">Alerta Comunitaria en Vivo</p>
              </div>
            </div>
          </button>
        </div>

        <div className="p-4 border-b border-border bg-muted/30">
          <h2 className="flex items-center gap-2 font-semibold tracking-tight text-foreground">
            <ShieldAlert className="h-4 w-4 text-blue-400" />
            Fuentes Oficiales
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Enlaces directos a autoridades en caso de emergencia.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          

          {/* Protección Civil Jalisco */}
          <div className="group relative flex flex-col rounded-xl border border-border/70 bg-card/40 shadow-sm overflow-hidden ring-1 ring-white/5">
            <div className="flex items-start gap-3 p-4 pb-3">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 ring-1 ring-blue-500/20">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1 mt-0.5">
                <h3 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                  Protección Civil Jal
                </h3>
              </div>
            </div>
            <div className="px-3 pb-3">
              <PremiumTwitterCard 
                handle="PCJalisco" 
                title="Comunicaciones Oficiales" 
                description="Últimos avisos y protocolos de emergencia en el estado."
                link="https://twitter.com/PCJalisco"
              />
            </div>
          </div>

          {/* CONAGUA Clima */}
          <div className="group relative flex flex-col rounded-xl border border-border/70 bg-card/40 shadow-sm overflow-hidden ring-1 ring-white/5">
            <div className="flex items-start gap-3 p-4 pb-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20">
                <CloudLightning className="h-5 w-5" />
              </div>
              <div className="flex-1 mt-0.5">
                <h3 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                  CONAGUA Clima
                </h3>
              </div>
            </div>
            <div className="px-3 pb-3">
              <PremiumTwitterCard 
                handle="conagua_clima" 
                title="Servicio Meteorológico" 
                description="Alertas hidrometeorológicas y seguimiento de ciclones."
                link="https://twitter.com/conagua_clima"
              />
            </div>
          </div>

          {/* Radar Doppler UdeG */}
          <div className="group relative flex flex-col gap-3 p-4 rounded-xl border border-border/70 bg-card/40 transition-colors shadow-sm ring-1 ring-white/5 hover:bg-card/60">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500 ring-1 ring-purple-500/20">
                <RadioTower className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                  Radar Doppler IAM
                  <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-colors" />
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">Instituto de Astronomía y Met. UdeG</p>
              </div>
            </div>
            <a 
              href="http://iam.cucei.udg.mx/radar/iam" 
              target="_blank" 
              rel="noreferrer"
              className="text-xs font-medium text-purple-400 hover:text-purple-300 w-full text-center py-2.5 bg-purple-500/10 rounded-lg transition-colors border border-purple-500/20 hover:bg-purple-500/20"
            >
              Abrir Radar en Vivo
            </a>
          </div>

        </div>
      </aside>

      {/* 2. CENTRO: MAPA Y SLIDER */}
      <section className="relative flex-1 flex flex-col min-w-0">
        <div className="flex-1 relative">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex flex-col gap-2 p-3">
            <div className="flex items-center justify-between">
              <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-border bg-card/80 px-3 py-2 backdrop-blur shadow-sm">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="font-mono text-xs tabular-nums text-foreground capitalize">
                  {formatDate(currentData.hora_local)}
                </span>
              </div>
            
              <div className="flex gap-2">
                {lastFetchTime && (
                  <div className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-border bg-card/80 px-3 py-2 backdrop-blur shadow-sm hidden sm:flex">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                      Actualizado: {new Date(lastFetchTime).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                )}
                <div className="pointer-events-auto flex items-center gap-2 rounded-lg border bg-card/80 px-3 py-2 backdrop-blur shadow-sm" style={{ borderColor: `color-mix(in oklch, ${globalMeta.token} 50%, transparent)` }}>
                  <Layers className="h-4 w-4" style={{ color: globalMeta.token }} />
                  <span className="font-mono text-xs font-semibold uppercase" style={{ color: globalMeta.token }}>
                    Alerta Máxima: {globalMeta.label}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="h-full w-full">
            {memoizedMap}
          </div>
        </div>
        <div className="p-6 bg-card border-t z-[1001] shadow-[0_-10px_40px_rgba(0,0,0,0.1)] shrink-0">
          <TimeSlider data={data} initialIndex={timeIndex} onChange={setTimeIndex} onGoLive={handleGoLive} />
        </div>
      </section>

      {/* 3. PANEL DERECHO: ALERTAS AUTOMÁTICO */}
      <aside className="w-full lg:w-80 flex flex-col bg-card/95 border-l border-border backdrop-blur z-[1001] h-[40vh] lg:h-full overflow-hidden shrink-0">
        <div className="p-4 border-b border-border bg-muted/30">
          <h2 className="flex items-center gap-2 font-semibold tracking-tight text-foreground">
            <AlertTriangle className="h-4 w-4 text-primary" />
            Zonas de Riesgo
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Clasificando las {mapData.length} zonas de monitoreo por nivel de inestabilidad.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {mapData.map((d) => {
            const meta = RISK_META[d.result.level as keyof typeof RISK_META];
            const isAlert = d.result.level === "critical" || d.result.level === "high";
            
            return (
              <div 
                key={d.city} 
                className={`relative flex flex-col gap-2 p-3 rounded-lg border transition-all ${isAlert ? 'shadow-lg scale-[1.02] bg-card' : 'bg-card/50'}`}
                style={{ 
                  borderColor: isAlert ? meta.token : 'transparent',
                  boxShadow: isAlert ? `0 0 20px -5px color-mix(in oklch, ${meta.token} 40%, transparent)` : 'none'
                }}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-sm text-foreground truncate max-w-[140px]" title={d.city}>{d.city}</h3>
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md shrink-0" style={{ backgroundColor: `color-mix(in oklch, ${meta.token} 15%, transparent)` }}>
                    {isAlert && <span className="flex h-1.5 w-1.5 rounded-full animate-ping" style={{ backgroundColor: meta.token }}></span>}
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: meta.token }}>
                      {meta.label}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 mt-1 border-t border-border/50 pt-2 text-[10px]">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Temp Aire</span>
                    <span className="font-mono text-foreground font-medium">{d.inputs.t850.toFixed(1)}°</span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Temp Agua</span>
                    <span className="font-mono text-foreground font-medium">{d.inputs.sst.toFixed(1)}°</span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Viento</span>
                    <span className="font-mono text-foreground font-medium">{d.inputs.wind.toFixed(1)} km/h</span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>SWI</span>
                    <span className="font-mono font-bold" style={{ color: isAlert ? meta.token : 'currentColor' }}>{d.result.score}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </main>

    {showReportModal && (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-card w-full max-w-md rounded-2xl border border-red-500/30 shadow-2xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-border bg-red-500/10 flex items-center justify-between">
            <h2 className="text-lg font-bold text-red-500 flex items-center gap-2">
              ⚠️ Reporte Ciudadano
            </h2>
            <button onClick={() => setShowReportModal(false)} className="text-muted-foreground hover:text-foreground w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted">✕</button>
          </div>
          <form onSubmit={handleReportSubmit} className="p-5 flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-foreground">Sector del Avistamiento</label>
              <select name="sector" required className="w-full p-2.5 rounded-lg bg-background border border-border text-sm text-foreground focus:ring-2 focus:ring-red-500/50 outline-none transition-all">
                <option value="">Selecciona una zona...</option>
                {Object.keys(CIUDADES_COORDS).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-foreground">Nivel de Peligro</label>
              <select name="dangerLevel" required className="w-full p-2.5 rounded-lg bg-background border border-border text-sm text-foreground focus:ring-2 focus:ring-red-500/50 outline-none transition-all">
                <option value="Tromba Observada (Tocando agua)">Tromba Observada (Tocando agua)</option>
                <option value="Nube Embudo (En el aire)">Nube Embudo (En el aire)</option>
                <option value="Nubes Oscuras de Rotación">Nubes Oscuras de Rotación</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 text-foreground">Observaciones Breves</label>
              <input name="description" type="text" placeholder="Ej: Se mueve hacia Mezcala, viento muy fuerte" className="w-full p-2.5 rounded-lg bg-background border border-border text-sm text-foreground focus:ring-2 focus:ring-red-500/50 outline-none transition-all" />
            </div>
            <div className="mt-4 flex gap-3">
              <button type="button" onClick={() => setShowReportModal(false)} className="flex-1 p-2.5 rounded-lg border border-border bg-background hover:bg-muted text-sm font-medium transition-colors">Cancelar</button>
              <button type="submit" disabled={isSubmitting} className="flex-1 p-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold disabled:opacity-50 flex justify-center items-center shadow-lg shadow-red-500/20 transition-all">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar Alerta Inmediata"}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}
    </>
  )
}