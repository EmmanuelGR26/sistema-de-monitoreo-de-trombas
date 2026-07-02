export interface PronosticoHora {
  hora_local: string;
  sst_lago_c: number | null;
  t850_c: number | null;
  cizalladura_850_ms: number | null;
  wind_speed_10m?: number | null;
  swi?: number | null;
}

export async function fetchPronosticoData(): Promise<PronosticoHora[]> {
  try {
    const res = await fetch("/pronostico.json");
    if (!res.ok) {
      throw new Error("Failed to fetch");
    }
    const data = await res.json();
    return data as PronosticoHora[];
  } catch (error) {
    console.warn("No se pudo cargar /pronostico.json, generando datos simulados...");
    return generateMockData();
  }
}

function generateMockData(): PronosticoHora[] {
  const data: PronosticoHora[] = [];
  const now = new Date();
  now.setMinutes(0, 0, 0); // Empezar en una hora en punto
  
  for (let i = 0; i < 168; i++) {
    const d = new Date(now.getTime() + i * 60 * 60 * 1000);
    const hora_local = d.toLocaleString('es-MX', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    // Simular un ciclo diario (24 horas)
    const hourCycle = (i % 24) / 24; 
    
    // Temperatura variando con una onda senoidal (más frío en la madrugada, más caliente en la tarde)
    const t850_c = 15 + 5 * Math.sin(hourCycle * 2 * Math.PI - Math.PI / 2); 
    
    // Temperatura del agua variando con coseno (ciclo un poco diferente)
    const sst_lago_c = 25 + 2 * Math.cos(hourCycle * 2 * Math.PI); 
    
    // Viento con algo de aleatoriedad/variación usando seno también
    const cizalladura_850_ms = 10 + 15 * Math.abs(Math.sin(i * 0.15));

    data.push({
      hora_local,
      sst_lago_c: Number(sst_lago_c.toFixed(1)),
      t850_c: Number(t850_c.toFixed(1)),
      cizalladura_850_ms: Number(cizalladura_850_ms.toFixed(1)),
    });
  }
  return data;
}
