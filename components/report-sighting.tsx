'use client';

import { useState } from 'react';
import { AlertTriangle, Send, Loader2, CheckCircle } from 'lucide-react';

export function ReportSighting() {
  const [isOpen, setIsOpen] = useState(false);
  const [ubicacion, setUbicacion] = useState('');
  const [dangerLevel, setDangerLevel] = useState('moderado');
  const [descripcion, setDescripcion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | null; text: string }>({ type: null, text: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setStatusMessage({ type: null, text: '' });

    try {
      const response = await fetch('/api/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ubicacion, dangerLevel, descripcion }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al enviar el reporte');
      }

      setUbicacion('');
      setDescripcion('');
      setDangerLevel('moderado');
      setStatusMessage({ type: 'success', text: 'Reporte enviado con éxito. En espera de verificación oficial.' });
      
      // Cerrar modal automáticamente después de unos segundos
      setTimeout(() => {
        setIsOpen(false);
        setStatusMessage({ type: null, text: '' });
      }, 5000);

    } catch (error) {
      setStatusMessage({ type: 'error', text: error instanceof Error ? error.message : 'Error de conexión' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-red-600/90 hover:bg-red-500 text-white px-5 py-3 rounded-full font-medium shadow-lg shadow-red-900/50 backdrop-blur-sm transition-all duration-300 ring-1 ring-red-500/50"
      >
        <AlertTriangle className="w-5 h-5" />
        <span>Reportar Avistamiento</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl w-full max-w-md shadow-2xl relative">
        <button 
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white"
        >
          ✕
        </button>
        
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          Reportar Tromba Marina
        </h2>
        
        <p className="text-zinc-400 text-sm mb-6">
          Si observas actividad de trombas marinas (waterspouts) en el lago, por favor compártenos la ubicación. Esto ayuda a la comunidad.
        </p>

        {statusMessage.type === 'success' ? (
          <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-xl flex items-start gap-3 mb-4">
            <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm font-medium">{statusMessage.text}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Sector / Ubicación *</label>
              <input 
                type="text" 
                required
                value={ubicacion}
                onChange={(e) => setUbicacion(e.target.value)}
                maxLength={100}
                placeholder="Ej. Frente a Ajijic, Centro del Lago..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Nivel de Peligro Percibido</label>
              <select 
                value={dangerLevel}
                onChange={(e) => setDangerLevel(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all appearance-none"
              >
                <option value="bajo">Bajo (Lejos en el agua)</option>
                <option value="moderado">Moderado (Se mueve, pero lejos)</option>
                <option value="alto">Alto (Cerca de la costa/embarcaciones)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-1">Observaciones (Opcional)</label>
              <textarea 
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                maxLength={150}
                rows={3}
                placeholder="Dirección hacia la que se mueve, tamaño aproximado..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 transition-all resize-none"
              />
              <div className="text-right text-xs text-zinc-500 mt-1">
                {descripcion.length}/150
              </div>
            </div>

            {statusMessage.type === 'error' && (
              <div className="text-red-400 text-sm p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                {statusMessage.text}
              </div>
            )}

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg flex items-center justify-center gap-2 transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Enviar Reporte
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
