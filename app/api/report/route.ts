import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sector, dangerLevel, description } = body;

    const telegramToken = process.env.TELEGRAM_TOKEN;
    const chatId = process.env.CHAT_ID;

    if (!telegramToken || !chatId) {
      console.error("Faltan TELEGRAM_TOKEN o CHAT_ID en las variables de entorno.");
      return NextResponse.json({ error: 'Configuración de servidor incompleta.' }, { status: 500 });
    }

    const message = `🚨 *NOWCASTING: REPORTE CIUDADANO EN VIVO* 🚨\n\n*Sector de Avistamiento:* ${sector}\n*Nivel de Peligro Percibido:* ${dangerLevel}\n*Observaciones:* ${description || 'N/A'}\n\n_Alerta disparada desde el Dashboard de la Comunidad._`;

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
      console.error("Error al enviar a Telegram:", errorData);
      return NextResponse.json({ error: `Error enviando alerta a Telegram.` }, { status: 502 });
    }

    return NextResponse.json({ success: true, message: 'Alerta enviada exitosamente.' });
  } catch (error) {
    console.error("Error en endpoint de reporte:", error);
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 });
  }
}
