import { NextResponse } from 'next/server';

// Rate Limiter simple en memoria: { [ip: string]: { count: number, resetTime: number } }
const rateLimitCache = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minuto
const MAX_REQUESTS_PER_WINDOW = 3;

// Función simple de sanitización XSS (elimina tags HTML y recorta)
function sanitizeString(str: string | undefined): string {
  if (!str) return '';
  return str.replace(/<[^>]*>?/gm, '').substring(0, 150).trim();
}

export async function POST(request: Request) {
  try {
    // 1. El Cadenero (Anti-Spam / Rate Limiting)
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    const now = Date.now();
    
    if (ip !== 'unknown') {
      const record = rateLimitCache.get(ip);
      if (record) {
        if (now < record.resetTime) {
          if (record.count >= MAX_REQUESTS_PER_WINDOW) {
            return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
          }
          record.count++;
        } else {
          rateLimitCache.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
        }
      } else {
        rateLimitCache.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
      }
    }

    // 2. La Cuarentena (Extracción y Sanitización XSS)
    const body = await request.json();
    
    // Soportamos las keys en español (ubicacion/descripcion) o en inglés (sector/description)
    const sector = sanitizeString(body.ubicacion || body.sector); 
    const description = sanitizeString(body.descripcion || body.description);
    const dangerLevel = sanitizeString(body.dangerLevel); // Opcional, dependiendo de la UI

    if (!sector) {
      return NextResponse.json({ error: 'La ubicación es requerida' }, { status: 400 });
    }

    // 3. El Filtro (Envío a Telegram sin almacenar DB)
    const telegramToken = process.env.TELEGRAM_TOKEN;
    const chatId = process.env.CHAT_ID;

    if (!telegramToken || !chatId) {
      console.error("Faltan TELEGRAM_TOKEN o CHAT_ID en las variables de entorno.");
      return NextResponse.json({ error: 'Configuración de servidor incompleta.' }, { status: 500 });
    }

    const message = `🚨 *NOWCASTING: REPORTE CIUDADANO EN VIVO* 🚨\n\n*Sector de Avistamiento:* ${sector}\n*Nivel de Peligro:* ${dangerLevel || 'N/A'}\n*Observaciones:* ${description || 'N/A'}\n\n_Alerta validada vía IP Cadenero._`;

    const response = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      const safeErrorData = errorData.replace(telegramToken, '[TOKEN OCULTO]');
      console.error("Error al enviar a Telegram:", safeErrorData);
      return NextResponse.json({ error: `Error enviando alerta a Telegram.` }, { status: 502 });
    }

    return NextResponse.json({ success: true, message: 'Alerta enviada exitosamente.' });
  } catch (error) {
    const errStr = String(error);
    const telegramToken = process.env.TELEGRAM_TOKEN;
    const safeErrorStr = telegramToken ? errStr.replace(telegramToken, '[TOKEN OCULTO]') : errStr;
    console.error("Error en endpoint de reporte:", safeErrorStr);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
