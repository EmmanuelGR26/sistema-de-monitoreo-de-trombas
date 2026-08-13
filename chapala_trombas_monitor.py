"""
Monitor de Trombas Marinas (Waterspouts) — Lago de Chapala, México
====================================================================
Calcula una aproximación formal del Índice de Trombas de Szilagyi (SWI)
usando datos gratuitos de la API de Open-Meteo.

IMPORTANTE — LEE ESTO ANTES DE USAR EN PRODUCCIÓN:
El SWI original (Szilagyi, 2009) fue derivado empíricamente de 263 casos de
trombas en los Grandes Lagos y se publicó como un NOMOGRAMA gráfico (dos
ejes: choque térmico Lago-850hPa y profundidad de nube convectiva EL-LCL).
Szilagyi nunca publicó la ecuación de regresión exacta de esas líneas de
umbral; solo el International Centre for Waterspout Research la tiene.
Por lo tanto, la función `nomograma_a_swi()` de este script es una
APROXIMACIÓN matemática transparente (no la fórmula propietaria exacta),
calibrada con el único punto de referencia cuantitativo documentado en la
literatura revisada por pares: un caso real en Hong Kong (Lo et al.) con
choque térmico = 7.6 °C y profundidad convectiva ≈ 46,000 ft, que produjo
un SWI ≈ 10. Debes recalibrar las constantes UMBRAL_TERMICO_C y
UMBRAL_PROFUNDIDAD_FT con casos reales observados en Chapala.

Variables de Open-Meteo usadas:
  - Forecast API (api.open-meteo.com/v1/forecast):
      temperature_2m, dew_point_2m, surface_pressure
      soil_temperature_0cm   -> proxy de temperatura superficial del agua
                                 (el modelo ICON de DWD usa el esquema de
                                 lago FLake en cuerpos de agua interiores
                                 grandes como Chapala; por eso es más fiable
                                 aquí que la Marine API, que está pensada
                                 para OCÉANOS).
      temperature_{p}hPa y geopotential_height_{p}hPa para un set de
      niveles de presión -> perfil vertical para calcular LCL y EL.
  - Marine API (marine-api.open-meteo.com/v1/marine):
      sea_surface_temperature -> se consulta como referencia cruzada, pero
      NO se usa como fuente primaria porque su cobertura de lagos
      interiores no está garantizada. Verifica tú mismo cuál de las dos
      fuentes da valores realistas para Chapala (24-29 °C aprox.) antes de
      confiar en ella operativamente.

Autor: generado con Claude (Anthropic) a partir de literatura de Szilagyi
(2009), Renko et al. (2018) y Lo et al. (Advances in Meteorology).
"""

import sys
sys.stdout.reconfigure(encoding='utf-8')
import math
import json
import os
from datetime import datetime
from zoneinfo import ZoneInfo
import time

import requests

# ----------------------------------------------------------------------
# 1. CONFIGURACIÓN
# ----------------------------------------------------------------------

CIUDADES = {
    "Oeste (Jocotepec)": {"lat": 20.270, "lon": -103.350},
    "Oeste (S.J. Cosalá)": {"lat": 20.260, "lon": -103.300},
    "Oeste-Centro (Ajijic)": {"lat": 20.270, "lon": -103.250},
    "Oeste-Centro (Ajijic Profundo)": {"lat": 20.240, "lon": -103.250},
    "San Cristóbal": {"lat": 20.2368, "lon": -103.3603},
    "Norte (Chapala)": {"lat": 20.270, "lon": -103.180},
    "Centro (Norte Chapala Profundo)": {"lat": 20.250, "lon": -103.150},
    "Isla de Mezcala": {"lat": 20.290, "lon": -103.023},
    "Mezcala": {"lat": 20.245, "lon": -103.030},
    "Mezcala Profundo": {"lat": 20.220, "lon": -103.080},
    "San Pedro Iztacán": {"lat": 20.290, "lon": -102.955},
    "Jamay": {"lat": 20.280, "lon": -102.750},
    "Ocotlán": {"lat": 20.290, "lon": -102.730},
    "Jamay Frente": {"lat": 20.260, "lon": -102.800},
    "Centro-Este": {"lat": 20.250, "lon": -102.900},
    "Tuxcueca": {"lat": 20.200, "lon": -103.180},
    "San Luis Soyatlán": {"lat": 20.2167, "lon": -103.2958},
    "Tizapán": {"lat": 20.190, "lon": -103.050},
    "Cojumatlán": {"lat": 20.150, "lon": -102.830},
    "Costa Palo Alto - Zapata": {"lat": 20.180, "lon": -102.950}
}
ELEVACION_M = 1524        # Elevación del espejo de agua sobre el nivel del mar (m)
ZONA_HORARIA = "America/Mexico_City"

# --- Configuración de Telegram ---

TELEGRAM_TOKEN = os.environ.get("TELEGRAM_TOKEN")
CHAT_ID = os.environ.get("CHAT_ID")

# Niveles de presión a descargar (hPa). 300 hPa (~9 km) es suficiente
# para trombas de buen tiempo / asociadas a tormenta moderada. Si te
# interesan también tormentas severas muy profundas, agrega 250 y 200 hPa.
NIVELES_HPA = [1000, 950, 925, 900, 850, 800, 700, 600, 500, 400, 300]

# --- Constantes de calibración del SWI (¡ajustables!) -------------------
# Punto cero: por debajo de este choque térmico, se considera ambiente
# no favorable (valor de partida razonable según literatura de Grandes
# Lagos; ajústalo con tus propias observaciones de Chapala).
UMBRAL_TERMICO_C = 3.0
RANGO_TERMICO_C = 5.0     # ΔT que satura el componente térmico (3 -> 8 °C)

UMBRAL_PROFUNDIDAD_FT = 5000.0
RANGO_PROFUNDIDAD_FT = 8000.0   # profundidad que satura el componente (5000 -> 13000 ft)

PESO_TERMICO = 0.5
PESO_PROFUNDIDAD = 0.5

# --- Filtros de calibración anti-falsos-positivos (Reglas 1–4) ----------
# Ajusta estos umbrales con tus observaciones de Chapala para calibrar
# la sensibilidad del sistema. Cada constante está documentada en la
# función que la usa.

# Regla 1 — Filtro de Humedad
UMBRAL_HUMEDAD_PCT       = 70.0  # HR mínima (%) para un embudo activo
SWI_CAP_HUMEDAD_BAJA     = 3.0  # Techo SWI cuando HR < umbral (escala -10/+10 ≈ display 65/100)

# Regla 2 — Exigencia del Choque Térmico
# El ΔT actúa como factor multiplicativo: SWI_max = (ΔT / UMBRAL) × 10
# A ΔT=4°C el techo baja a 5; a ΔT=8°C el techo es 10 (sin restricción).
UMBRAL_TERMICO_CRITICO_C = 8.0  # ΔT mínimo para alcanzar SWI=10 crítico (°C)

# Regla 3 — Viento Triturador
UMBRAL_VIENTO_TRITURADOR = 40.0  # Velocidad (km/h) que destruye la organización del vórtice
# El SWI se divide entre 2 si el viento supera este umbral.

# Regla 4 — Persistencia Temporal
# SWI_CAP_SIN_PERSISTENCIA se expresa en la escala -10/+10;
# en display 0-100 equivale a: int((8 + 10) * 5) = 90 ("Muy Alto" pero no "Crítico")
UMBRAL_SWI_PREVIO        = 2.0  # SWI previo mínimo (≈ display 60) para desbloquear alerta máxima
SWI_CAP_SIN_PERSISTENCIA = 8.0  # Techo SWI si no hay confirmación en lectura anterior

# Constantes físicas
G = 9.80665        # gravedad, m/s^2
RD = 287.05        # constante de gas para aire seco, J/(kg·K)
CP = 1004.0        # calor específico del aire seco a presión cte, J/(kg·K)
LV = 2.501e6       # calor latente de vaporización, J/kg
EPS = 0.622        # Rd/Rv


# ----------------------------------------------------------------------
# 2. DESCARGA DE DATOS (Open-Meteo)
# ----------------------------------------------------------------------

def descargar_datos_batch(ciudades_dict):
    """Descarga el pronóstico horario y la SST marina para TODAS las ciudades en lote."""
    ciudades_lista = list(ciudades_dict.keys())
    lats = ",".join(str(ciudades_dict[c]["lat"]) for c in ciudades_lista)
    lons = ",".join(str(ciudades_dict[c]["lon"]) for c in ciudades_lista)

    params_forecast = {
        "latitude": lats,
        "longitude": lons,
        "current": "wind_speed_10m,surface_pressure,weather_code",
        # Regla 1: se añade relative_humidity_2m para el filtro de humedad.
        "minutely_15": "temperature_2m,dew_point_2m,relative_humidity_2m,surface_pressure,soil_temperature_0cm,wind_speed_10m,temperature_1000hPa,geopotential_height_1000hPa,temperature_950hPa,geopotential_height_950hPa,temperature_925hPa,geopotential_height_925hPa,temperature_900hPa,geopotential_height_900hPa,temperature_850hPa,geopotential_height_850hPa,temperature_800hPa,geopotential_height_800hPa,temperature_700hPa,geopotential_height_700hPa,temperature_600hPa,geopotential_height_600hPa,temperature_500hPa,geopotential_height_500hPa,temperature_400hPa,geopotential_height_400hPa,temperature_300hPa,geopotential_height_300hPa",
        "timezone": ZONA_HORARIA,
        "forecast_days": 3,
    }
    
    max_reintentos = 3
    forecasts = None
    for intento in range(max_reintentos):
        try:
            r = requests.get("https://api.open-meteo.com/v1/forecast", params=params_forecast, timeout=60, verify=False)
            r.raise_for_status()
            forecasts_raw = r.json()
            # Open-Meteo retorna una lista si hay múltiples coordenadas, o un dict si es solo una.
            forecasts = forecasts_raw if isinstance(forecasts_raw, list) else [forecasts_raw]
            break
        except requests.exceptions.RequestException as e:
            if intento < max_reintentos - 1:
                print(f"Error descargando datos en lote (Forecast): {e}. Reintentando ({intento+1}/{max_reintentos})...")
                time.sleep(5)
            else:
                raise e

    # Descarga Marina (Reference)
    params_marine = {
        "latitude": lats,
        "longitude": lons,
        "hourly": "sea_surface_temperature",
        "timezone": ZONA_HORARIA,
        "forecast_days": 3,
    }
    
    marines = [None] * len(ciudades_dict)
    try:
        rm = requests.get("https://marine-api.open-meteo.com/v1/marine", params=params_marine, timeout=60, verify=False)
        if rm.ok:
            marines_raw = rm.json()
            marines = marines_raw if isinstance(marines_raw, list) else [marines_raw]
    except requests.RequestException:
        pass  # la Marine API puede no tener cobertura en un lago interior

    # Mapear de vuelta a un diccionario por nombre de ciudad
    forecast_dict = {}
    marine_dict = {}
    for i, ciudad in enumerate(ciudades_lista):
        forecast_dict[ciudad] = forecasts[i] if forecasts and i < len(forecasts) else None
        marine_dict[ciudad] = marines[i] if marines and i < len(marines) else None
        
    return forecast_dict, marine_dict


def indice_hora_actual(lista_tiempos_iso):
    """Encuentra el índice del arreglo horario más cercano a 'ahora' en
    la zona horaria del lago."""
    ahora = datetime.now(ZoneInfo(ZONA_HORARIA))
    tiempos = [datetime.fromisoformat(t).replace(tzinfo=ZoneInfo(ZONA_HORARIA)) for t in lista_tiempos_iso]
    diffs = [abs((t - ahora).total_seconds()) for t in tiempos]
    return diffs.index(min(diffs))


# ----------------------------------------------------------------------
# 3. TERMODINÁMICA: LCL y EL (profundidad convectiva)
# ----------------------------------------------------------------------

def presion_vapor_saturacion(t_c):
    """Fórmula de Bolton (1980), hPa."""
    return 6.112 * math.exp((17.67 * t_c) / (t_c + 243.5))


def razon_mezcla_saturacion(t_c, p_hpa):
    """kg/kg"""
    es = presion_vapor_saturacion(t_c)
    return EPS * es / max(p_hpa - es, 0.1)


def lapso_adiabatico_saturado(t_c, p_hpa):
    """Tasa de enfriamiento (°C/m) de una parcela saturada (pseudo-adiabática)."""
    t_k = t_c + 273.15
    ws = razon_mezcla_saturacion(t_c, p_hpa)
    numerador = G * (1 + (LV * ws) / (RD * t_k))
    denominador = CP + (LV ** 2 * ws * EPS) / (RD * t_k ** 2)
    return numerador / denominador  # °C/m


def altura_lcl_m(t2m_c, td2m_c):
    """Aproximación de Espy/Stull, altura del LCL sobre el nivel del lago, en metros."""
    return max(125.0 * (t2m_c - td2m_c), 0.0)


def construir_perfil(forecast, idx):
    """Devuelve listas paralelas (altura_m_msnm, presion_hpa, temp_c) ordenadas
    de menor a mayor altura, a partir de los niveles de presión descargados."""
    h = forecast["minutely_15"]
    alturas, presiones, temps = [], [], []
    for p in NIVELES_HPA:
        z = h.get(f"geopotential_height_{p}hPa", [None] * (idx + 1))[idx]
        t = h.get(f"temperature_{p}hPa", [None] * (idx + 1))[idx]
        if z is None or t is None:
            continue
        alturas.append(z)
        presiones.append(p)
        temps.append(t)
    orden = sorted(range(len(alturas)), key=lambda i: alturas[i])
    return [alturas[i] for i in orden], [presiones[i] for i in orden], [temps[i] for i in orden]


def interpolar(x, xs, ys):
    """Interpolación lineal simple; extrapola con el valor del extremo más cercano."""
    if x <= xs[0]:
        return ys[0]
    if x >= xs[-1]:
        return ys[-1]
    for i in range(len(xs) - 1):
        if xs[i] <= x <= xs[i + 1]:
            frac = (x - xs[i]) / (xs[i + 1] - xs[i])
            return ys[i] + frac * (ys[i + 1] - ys[i])
    return ys[-1]


def calcular_lcl_el(t2m_c, td2m_c, p_superficie_hpa, perfil_alturas, perfil_presiones, perfil_temps):
    """
    Asciende una parcela desde la superficie del lago:
      1) Adiabática seca hasta el LCL.
      2) Pseudo-adiabática saturada por encima del LCL, integrando paso a
         paso, comparando contra el ambiente para hallar el EL (altura
         donde la parcela deja de ser más cálida que el ambiente, tras
         haber sido positivamente boyante).

    Devuelve (lcl_altura_msnm, el_altura_msnm o None si no hay flotabilidad).
    """
    lcl_agl = altura_lcl_m(t2m_c, td2m_c)
    altura_lago_base = ELEVACION_M
    lcl_msnm = altura_lago_base + lcl_agl

    # Temperatura de la parcela en el LCL (enfriamiento adiabático seco, 9.8 °C/km)
    t_parcela_lcl = t2m_c - 9.8 * (lcl_agl / 1000.0)

    dz = 50.0  # paso de integración, m
    z = lcl_msnm
    t_parcela = t_parcela_lcl
    el_msnm = None
    estuvo_boyante = False

    altura_max = perfil_alturas[-1]
    while z < altura_max:
        p_amb = interpolar(z, perfil_alturas, perfil_presiones)
        t_amb = interpolar(z, perfil_alturas, perfil_temps)

        if t_parcela > t_amb:
            estuvo_boyante = True
        elif estuvo_boyante and t_parcela <= t_amb:
            el_msnm = z
            break

        tasa = lapso_adiabatico_saturado(t_parcela, p_amb)  # °C/m
        t_parcela -= tasa * dz
        z += dz

    return lcl_msnm, el_msnm


# ----------------------------------------------------------------------
# 4. ÍNDICE DE TROMBAS DE SZILAGYI (aproximación)
# ----------------------------------------------------------------------

def nomograma_a_swi(choque_termico_c, profundidad_ft):
    """
    Mapea (choque térmico, profundidad convectiva) a un valor SWI en
    [-10, +10], siguiendo la forma conocida del nomograma de Szilagyi.
    Ver advertencia al inicio del archivo: esto es una aproximación
    calibrada, no la curva propietaria original.

    REGLA 2 — Gate multiplicativo del Choque Térmico:
      El ΔT no solo contribuye aditivamente (comp_termico) sino que
      actúa como techo del SWI final:

          cap_ΔT = clamp(ΔT / UMBRAL_TERMICO_CRITICO_C × 10,  0, 10)

      Efecto en práctica:
        ΔT = 2°C  →  cap = 2.5  (nunca supera nivel moderado-bajo)
        ΔT = 4°C  →  cap = 5.0  (techo a mitad de escala)
        ΔT = 6°C  →  cap = 7.5  (alto pero no crítico)
        ΔT ≥ 8°C  →  cap = 10   (sin restricción adicional)

      Esto impide que una nube profunda (profundidad_ft alta) con ΔT
      bajo dispare una alerta crítica falsa.
    """
    comp_termico = (choque_termico_c - UMBRAL_TERMICO_C) / RANGO_TERMICO_C * 10
    comp_termico = max(-10.0, min(10.0, comp_termico))

    comp_profundidad = (profundidad_ft - UMBRAL_PROFUNDIDAD_FT) / RANGO_PROFUNDIDAD_FT * 10
    comp_profundidad = max(-10.0, min(10.0, comp_profundidad))

    swi = PESO_TERMICO * comp_termico + PESO_PROFUNDIDAD * comp_profundidad

    # Regla 2: el ΔT es un gate multiplicativo — impone el techo del SWI.
    cap_delta_t = (choque_termico_c / UMBRAL_TERMICO_CRITICO_C) * 10.0
    cap_delta_t = max(0.0, min(10.0, cap_delta_t))
    swi = min(swi, cap_delta_t)

    return round(max(-10.0, min(10.0, swi)), 1)


def cizalladura_850_aux(forecast, idx):
    """No forma parte del SWI, pero se calcula como dato de contexto:
    cizalladura vectorial aproximada entre el viento de 10 m y 850 hPa.
    Ambientes con cizalladura baja son tradicionalmente más favorables
    para trombas de buen tiempo (la rotación se desorganiza con mucha
    cizalladura)."""
    h = forecast["minutely_15"]
    claves_necesarias = ["wind_speed_10m", "wind_direction_10m",
                          "wind_speed_850hPa", "wind_direction_850hPa"]
    if not all(k in h for k in claves_necesarias):
        return None
    ws0, wd0 = h["wind_speed_10m"][idx], h["wind_direction_10m"][idx]
    ws850, wd850 = h["wind_speed_850hPa"][idx], h["wind_direction_850hPa"][idx]

    def a_uv(vel, direccion_grados):
        rad = math.radians(direccion_grados)
        return -vel * math.sin(rad), -vel * math.cos(rad)

    u0, v0 = a_uv(ws0, wd0)
    u850, v850 = a_uv(ws850, wd850)
    return math.hypot(u850 - u0, v850 - v0)  # m/s


# ----------------------------------------------------------------------
# 5. ORQUESTACIÓN Y ALERTAS (PRONÓSTICO 7 DÍAS)
# ----------------------------------------------------------------------

def enviar_alerta_telegram(mensaje):
    """Envía un mensaje a través del bot de Telegram."""
    if TELEGRAM_TOKEN == "TU_TOKEN_AQUI" or not TELEGRAM_TOKEN:
        return # No intentar enviar si no se ha configurado
    
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    payload = {
        "chat_id": CHAT_ID,
        "text": mensaje,
        "parse_mode": "Markdown"
    }
    try:
        response = requests.post(url, json=payload, timeout=10)
        if response.status_code != 200:
            error_texto = response.text.replace(TELEGRAM_TOKEN, "[TOKEN OCULTO]") if TELEGRAM_TOKEN else response.text
            print(f"Error de Telegram: {response.status_code} - {error_texto}")
        else:
            print("Mensaje enviado a Telegram correctamente.")
    except Exception as e:
        error_msg = str(e).replace(TELEGRAM_TOKEN, "[TOKEN OCULTO]") if TELEGRAM_TOKEN else str(e)
        print(f"Error enviando notificación a Telegram: {error_msg}")

def procesar_hora(forecast, sst_marina, idx):
    """
    Calcula el SWI y variables para una hora específica del arreglo.

    Pipeline de filtros aplicados en este orden:
      1. nomograma_a_swi() → SWI base + gate ΔT  (Regla 2, ya dentro del nomograma)
      2. Filtro de Humedad                         (Regla 1)
      3. Penalización Viento Triturador             (Regla 3)
    La Regla 4 (Persistencia) se aplica en generar_pronostico()
    porque necesita el estado guardado de la ejecución anterior.
    """
    h = forecast["minutely_15"]

    t2m  = h["temperature_2m"][idx]
    td2m = h["dew_point_2m"][idx]
    p_sup = h["surface_pressure"][idx]
    t850  = h.get("temperature_850hPa", [None] * (idx + 1))[idx]

    # Regla 1: humedad relativa a 2 m (nueva variable)
    humedad_2m = h.get("relative_humidity_2m", [None] * (idx + 1))[idx]

    # Regla 3: viento de superficie (ya existía; ahora también altera el SWI)
    viento_10m = h.get("wind_speed_10m", [None] * (idx + 1))[idx]

    sst_lago = h.get("soil_temperature_0cm", [None] * (idx + 1))[idx]
    sst_marina_valor = None
    if sst_marina and "hourly" in sst_marina and "sea_surface_temperature" in sst_marina["hourly"]:
        try:
            sst_marina_valor = sst_marina["hourly"]["sea_surface_temperature"][idx // 4]
        except Exception:
            pass

    if sst_lago is None and sst_marina_valor is None:
        return {"hora_local": h["time"][idx], "swi": -10, "riesgo": "DESCONOCIDO",
                "filtros_swi": ["sin_sst"]}

    sst = sst_lago if sst_lago is not None else sst_marina_valor

    perfil_alturas, perfil_presiones, perfil_temps = construir_perfil(forecast, idx)
    lcl_msnm, el_msnm = calcular_lcl_el(t2m, td2m, p_sup,
                                          perfil_alturas, perfil_presiones, perfil_temps)

    choque_termico = sst - t850 if t850 is not None else 0
    if el_msnm is not None:
        profundidad_m  = el_msnm - lcl_msnm
        profundidad_ft = max(profundidad_m, 0.0) * 3.28084
    else:
        profundidad_ft = 0.0

    # SWI base: incluye el gate ΔT de la Regla 2 dentro del nomograma
    swi = nomograma_a_swi(choque_termico, profundidad_ft)
    swi_nomograma = swi          # guardar antes de filtros para auditoría
    filtros_aplicados = []

    # ------------------------------------------------------------------
    # REGLA 1 — Filtro de Humedad
    # Física: sin vapor de agua suficiente no hay condensación, y sin
    # condensación no se puede mantener la columna giratoria del embudo.
    # El umbral de 70 % es conservador para Chapala (ambiente subtropical);
    # ajústalo hacia arriba si sigues viendo falsos positivos.
    # Operación: si HR < UMBRAL_HUMEDAD_PCT, el SWI no puede superar
    # SWI_CAP_HUMEDAD_BAJA (por defecto 3.0, display ≈ 65/100).
    # ------------------------------------------------------------------
    if humedad_2m is not None and humedad_2m < UMBRAL_HUMEDAD_PCT:
        if swi > SWI_CAP_HUMEDAD_BAJA:
            swi = SWI_CAP_HUMEDAD_BAJA
            filtros_aplicados.append(
                f"R1-humedad:{humedad_2m:.0f}%<{UMBRAL_HUMEDAD_PCT:.0f}%→cap{SWI_CAP_HUMEDAD_BAJA}"
            )

    # ------------------------------------------------------------------
    # REGLA 3 — Viento Triturador
    # Física: vientos de superficie > 40 km/h generan turbulencia de
    # cizalladura que desintegra el vórtice antes de que llegue al agua.
    # Operación: el SWI resultante se divide entre 2 (penalización 50 %).
    # No se aplica si el viento ya destruyó la condición de riesgo
    # (swi <= 0), para no generar valores negativos sin sentido.
    # ------------------------------------------------------------------
    if viento_10m is not None and viento_10m > UMBRAL_VIENTO_TRITURADOR and swi > 0:
        swi = swi / 2.0
        filtros_aplicados.append(
            f"R3-viento:{viento_10m:.0f}km/h>{UMBRAL_VIENTO_TRITURADOR:.0f}→÷2"
        )

    swi = round(max(-10.0, min(10.0, swi)), 1)
    riesgo = "ALTO" if swi >= 0 else "BAJO"
    shear850 = cizalladura_850_aux(forecast, idx)

    return {
        "hora_local":              h["time"][idx],
        "sst_lago_c":              round(sst, 1),
        "t850_c":                  round(t850, 1) if t850 else None,
        "choque_termico_c":        round(choque_termico, 1),
        "lcl_msnm_m":              round(lcl_msnm, 0),
        "el_msnm_m":               round(el_msnm, 0) if el_msnm else None,
        "profundidad_convectiva_ft": round(profundidad_ft, 0),
        "humedad_2m_pct":          round(humedad_2m, 0) if humedad_2m is not None else None,
        "swi_nomograma":           swi_nomograma,   # SWI antes de Reglas 1 y 3 (diagnóstico)
        "swi":                     swi,
        "riesgo":                  riesgo,
        "filtros_swi":             filtros_aplicados,
        "cizalladura_850_ms":      round(shear850, 1) if shear850 is not None else None,
        "wind_speed_10m":          round(viento_10m, 1) if viento_10m is not None else None,
    }

def cargar_estado_previo():
    if os.path.exists("public/estado_previo.json"):
        try:
            with open("public/estado_previo.json", "r", encoding="utf-8") as f:
                return json.load(f)
        except:
            return {}
    return {}

def guardar_en_historial(coordenada, swi, clima_actual):
    # FIX: el umbral era 75, nunca alcanzable porque nomograma_a_swi() devuelve [-10,+10].
    # El único valor que lo superaba era el 75.1 forzado por tormenta_activa,
    # así que el historial solo registraba tormentas y nunca picos reales de SWI.
    # Ahora se registran todos los eventos de riesgo alto (SWI >= 0).
    if swi < 0:
        return
        
    archivo = "public/historial.json"
    historial = []
    
    if os.path.exists(archivo):
        try:
            with open(archivo, "r", encoding="utf-8") as f:
                historial = json.load(f)
        except:
            pass
            
    evento = {
        "fecha": clima_actual.get("time"),
        "ciudad": coordenada,
        "latitud": CIUDADES[coordenada]["lat"] if coordenada in CIUDADES else None,
        "longitud": CIUDADES[coordenada]["lon"] if coordenada in CIUDADES else None,
        "swi": swi,
        "clima_descripcion": clima_actual.get("wmo_desc", "Desconocido")
    }
    
    historial.append(evento)
    
    os.makedirs("public", exist_ok=True)
    with open(archivo, "w", encoding="utf-8") as f:
        json.dump(historial, f, ensure_ascii=False, indent=2)

def guardar_estado_actual(estado):
    os.makedirs("public", exist_ok=True)
    with open("public/estado_previo.json", "w", encoding="utf-8") as f:
        json.dump(estado, f, ensure_ascii=False, indent=2)

def actualizar_historial_local(datos_actuales):
    """
    Mantiene una base de datos local (caja negra) del estado actual del lago,
    conservando únicamente los últimos 7 días de registros reales para no perder
    las anomalías transitorias (ej. celdas de tormenta activas).
    """
    if not datos_actuales:
        return

    archivo = "public/historial_trombas.json"
    historial = {}
    
    if os.path.exists(archivo):
        try:
            with open(archivo, "r", encoding="utf-8") as f:
                historial = json.load(f)
        except Exception as e:
            print(f"[WARNING] No se pudo leer historial previo, se creará uno nuevo: {e}")
            
    # Obtener el timestamp del momento actual desde la primera ciudad
    primer_ciudad = list(datos_actuales.values())[0]
    timestamp = primer_ciudad.get("hora_local")
    
    if not timestamp:
        return
        
    historial[timestamp] = datos_actuales
    
    # Limpieza de datos antiguos (> 7 días)
    try:
        ahora = datetime.now(ZoneInfo(ZONA_HORARIA))
        claves_a_borrar = []
        for ts in historial.keys():
            dt = datetime.fromisoformat(ts).replace(tzinfo=ZoneInfo(ZONA_HORARIA))
            if (ahora - dt).days > 7:
                claves_a_borrar.append(ts)
        
        for k in claves_a_borrar:
            del historial[k]
    except Exception as e:
        print(f"[WARNING] Error al purgar historial antiguo: {e}")

    os.makedirs("public", exist_ok=True)
    try:
        with open(archivo, "w", encoding="utf-8") as f:
            json.dump(historial, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"[ERROR] No se pudo escribir historial local: {e}")

def generar_pronostico():
    """Genera el reporte actual y busca ventanas de riesgo en los próximos 3 días."""
    resultados_completo = {}
    alertas_globales = {}
    climas_actuales = {}
    
    estado_previo = cargar_estado_previo()
    nuevo_estado = {}
    alertas_nowcasting = []

    print("[INFO] Descargando datos de Open-Meteo en lote...")
    forecast_batch, marine_batch = descargar_datos_batch(CIUDADES)

    for ciudad, coords in CIUDADES.items():
        forecast = forecast_batch.get(ciudad)
        sst_marina = marine_batch.get(ciudad)
        
        if not forecast:
            print(f"[ERROR] No se pudo obtener forecast para {ciudad}")
            continue
        # --- Lógica NOWCASTING ---
        current = forecast.get("current", {})
        wind_now = current.get("wind_speed_10m", 0)
        pres_now = current.get("surface_pressure", 1013)
        wcode_now = current.get("weather_code", 0)
        
        nuevo_estado[ciudad] = {"presion": pres_now, "viento": wind_now, "time": current.get("time")}
        
        tormenta_activa = wcode_now in [95, 96, 99]
        estado_ciudad_previo = estado_previo.get(ciudad)
        if estado_ciudad_previo:
            pres_prev = estado_ciudad_previo.get("presion", pres_now)
            caida_presion = pres_now - pres_prev
            
            # Condición de pico violento físico O tormenta convectiva severa (WMO code 95, 96, 99)
            if wind_now >= 35 or caida_presion <= -3 or tormenta_activa:
                motivo = []
                if wind_now >= 35: motivo.append(f"Ráfaga {wind_now} km/h")
                if caida_presion <= -3: motivo.append(f"Caída {round(caida_presion, 2)} hPa")
                if tormenta_activa: motivo.append("Célula de Tormenta Activa Detectada")
                
                alertas_nowcasting.append({
                    "ciudad": ciudad,
                    "motivo": " | ".join(motivo)
                })

        h = forecast["minutely_15"]
        idx_actual = indice_hora_actual(h["time"])

        # FIX (Bug 2 y Bug 3): construir pronostico_ciudad PRIMERO, antes de cualquier
        # anulación por tormenta, para que ambas estructuras compartan la misma base.
        alertas_futuras = []
        pronostico_ciudad = []

        for i in range(len(h["time"])):
            datos_hora = procesar_hora(forecast, sst_marina, i)
            pronostico_ciudad.append(datos_hora)
            if i > idx_actual and datos_hora["swi"] >= 0:
                alertas_futuras.append(datos_hora)

        # climas_actuales apunta a la MISMA referencia de dict que pronostico_ciudad[idx_actual].
        # Así cualquier mutación posterior se refleja en ambas estructuras a la vez.
        climas_actuales[ciudad] = pronostico_ciudad[idx_actual]

        # ------------------------------------------------------------------
        # REGLA 4 — Persistencia Temporal
        # Física: una tromba no aparece de la nada. El ambiente debe haber
        # venido calentándose en ciclos previos (hora o ejecución anterior).
        # Un pico único aislado casi siempre es ruido del modelo.
        #
        # Operación:
        #   - Se lee el SWI de la EJECUCIÓN ANTERIOR desde estado_previo.json
        #     (clave "swi"; la primera vez no existe → asumir -10).
        #   - Si el SWI actual supera SWI_CAP_SIN_PERSISTENCIA (8.0) PERO
        #     el SWI previo no superaba UMBRAL_SWI_PREVIO (2.0), el SWI
        #     actual se techa en SWI_CAP_SIN_PERSISTENCIA.
        #   - El SWI que se guarda en nuevo_estado es el SWI del nomograma
        #     (pre-tormenta), para que la persistencia no se contamine con
        #     las anulaciones de tormenta_activa.
        #
        # IMPORTANTE: el override de tormenta_activa se aplica DESPUÉS de
        # este filtro. Una tormenta confirmada (WMO 95/96/99) es una
        # observación real, no una predicción del modelo, y sí puede
        # alcanzar nivel crítico sin persistencia previa.
        # ------------------------------------------------------------------
        swi_previo = float(estado_previo.get(ciudad, {}).get("swi", -10.0))
        swi_actual = climas_actuales[ciudad]["swi"]

        if swi_actual > SWI_CAP_SIN_PERSISTENCIA and swi_previo <= UMBRAL_SWI_PREVIO:
            climas_actuales[ciudad]["swi"] = SWI_CAP_SIN_PERSISTENCIA
            climas_actuales[ciudad]["filtros_swi"] = (
                climas_actuales[ciudad].get("filtros_swi", []) +
                [f"R4-persistencia:swi_prev={swi_previo:.1f}≤{UMBRAL_SWI_PREVIO}→cap{SWI_CAP_SIN_PERSISTENCIA}"]
            )
            # La misma clave en pronostico_ciudad (mismo objeto en memoria, pero
            # escribir explícitamente por claridad y para la web)
            pronostico_ciudad[idx_actual]["swi"] = SWI_CAP_SIN_PERSISTENCIA

        # Guardar el SWI del nomograma (no el de tormenta) para el ciclo siguiente.
        # Así la persistencia se basa en la condición atmosférica real, no en el override.
        nuevo_estado[ciudad]["swi"] = climas_actuales[ciudad]["swi"]

        # ------------------------------------------------------------------
        # Override de Tormenta Activa (bypasa persistencia por ser observación real)
        # ------------------------------------------------------------------
        if tormenta_activa:
            # El riesgo se eleva a 'critical' por la presencia de la tormenta
            climas_actuales[ciudad]["riesgo"] = "critical"
            
            # Sincronización forzada (JSON Array): Sobrescribir una ventana de +-2 intervalos 
            # (1 hora) alrededor del índice actual. Esto garantiza que la observación 
            # en tiempo real aplaste la predicción y el frontend jamás la pase por alto 
            # debido a diferencias en el redondeo de la hora local (floor vs round).
            for offset in [-2, -1, 0, 1, 2]:
                idx_sync = idx_actual + offset
                if 0 <= idx_sync < len(pronostico_ciudad):
                    pronostico_ciudad[idx_sync]["riesgo"] = "critical"
                    
                    # Regla de 'Piso de Riesgo': 
                    # El SWI no salta a 10 de golpe, tiene una base de 7.5
                    if pronostico_ciudad[idx_sync]["swi"] < 7.5:
                        pronostico_ciudad[idx_sync]["swi"] = 7.5
                        # Registrar en filtros
                        if "filtros_swi" not in pronostico_ciudad[idx_sync]:
                            pronostico_ciudad[idx_sync]["filtros_swi"] = []
                        if "R4-Tormenta: base 7.5" not in pronostico_ciudad[idx_sync]["filtros_swi"]:
                            pronostico_ciudad[idx_sync]["filtros_swi"].append("R4-Tormenta: base 7.5")

        # Registrar en el historial (bitácora) — usa el SWI definitivo
        guardar_en_historial(ciudad, climas_actuales[ciudad]["swi"], climas_actuales[ciudad])

        resultados_completo[ciudad] = pronostico_ciudad
        alertas_globales[ciudad] = alertas_futuras
        
    guardar_estado_actual(nuevo_estado)
    
    # Enviar alertas inmediatas de Nowcasting si existen
    if alertas_nowcasting:
        msg_nowcasting = "🚨 *[NOWCASTING - TIEMPO REAL]* 🚨\n\n¡Condiciones violentas detectadas en la red de monitoreo!\n\n"
        for al in alertas_nowcasting:
            msg_nowcasting += f"⚠️ *{al['ciudad']}*: {al['motivo']}\n"
        enviar_alerta_telegram(msg_nowcasting)
            
    return climas_actuales, alertas_globales, resultados_completo

if __name__ == "__main__":
    climas_actuales, alertas_globales, pronostico_completo = generar_pronostico()
    
    # --- GUARDAR DATOS PARA LA WEB ---
    try:
        os.makedirs("public", exist_ok=True)

        # pronostico.json: array completo de 3 días (para gráficas de tendencia en la web)
        filepath = os.path.join("public", "pronostico.json")
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(pronostico_completo, f, ensure_ascii=False, indent=2)
        print("[INFO] Archivo public/pronostico.json generado con éxito.")

        # FIX (Bug 3): estado_actual.json — nowcast del momento presente con SWI corregido.
        # La web debe leer ESTE archivo para mostrar el riesgo actual, NO el pronostico.json.
        # pronostico.json tiene ~288 entradas por ciudad; la web no puede saber cuál es "ahora"
        # sin parsear timestamps. estado_actual.json siempre tiene UN solo registro por ciudad.
        filepath_actual = os.path.join("public", "estado_actual.json")
        with open(filepath_actual, "w", encoding="utf-8") as f:
            json.dump(climas_actuales, f, ensure_ascii=False, indent=2)
        print("[INFO] Archivo public/estado_actual.json generado con éxito.")
        
        # Caja Negra: Guardar el historial local persistente
        actualizar_historial_local(climas_actuales)
        print("[INFO] Caja Negra (historial_trombas.json) actualizada con éxito.")

    except Exception as e:
        print(f"[ERROR] No se pudo guardar el JSON: {e}")

    # --- CONSTRUCCIÓN DEL MENSAJE PARA TELEGRAM (Multiciudad) ---
    # Tomamos la hora del primer reporte como referencia
    primer_ciudad = list(climas_actuales.values())[0]
    hora_str = datetime.fromisoformat(primer_ciudad['hora_local']).strftime('%H:%M')
    mensaje_tg = f"📊 *Resumen {hora_str} - Red de Monitoreo* 📊\n\n"
    
    for ciudad in CIUDADES:
        actual = climas_actuales[ciudad]
        swi_100 = int((actual['swi'] + 10) * 5)
        swi_100 = max(0, min(100, swi_100)) # Asegurar que se mantenga entre 0 y 100
        mensaje_tg += (
            f"📍 *{ciudad}*: Riesgo {actual['riesgo']} (SWI: {swi_100}) | ΔT: {actual['choque_termico_c']}°C\n"
        )
    
    print("\n--- PRONÓSTICO 3 DÍAS (VENTANAS DE RIESGO) ---")
    total_alertas = sum(len(alertas) for alertas in alertas_globales.values())
    if total_alertas == 0:
        print("No se detectan condiciones favorables para trombas en la red.")
        mensaje_tg += "\n🌤 *Pronóstico:* Sin ventanas de riesgo a futuro en la red."
    else:
        print(f"⚠️ Se detectaron {total_alertas} alertas en la red.")
        mensaje_tg += f"\n⚠️ *¡Alerta!* {total_alertas} ventanas de riesgo en la red.\n"
        for ciudad, alertas in alertas_globales.items():
            if alertas:
                print(f"-> {ciudad}: {len(alertas)} alertas")
            
    # --- ENVÍO DE ALERTA (SOLO SI HAY PELIGRO O ES REPORTE ÚTIL) ---
    if total_alertas > 0:
        enviar_alerta_telegram(mensaje_tg)
        print("\n[INFO] Ejecución terminada. Resumen enviado por alertas detectadas.")
    else:
        print("\n[INFO] Ejecución terminada. Todo tranquilo, sin alertas que enviar (Silencio Activo).")