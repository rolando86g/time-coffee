'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function Home() {
  const [mensajes, setMensajes] = useState<any[]>([]);
  const [nuevoTexto, setNuevoTexto] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const cargarMensajes = async () => {
    setErrorMsg(null);
    const { data, error } = await supabase
      .from('mensajes')
      .select('*')
      .order('id', { ascending: false });

    if (error) {
      setErrorMsg(`Error al leer DB: ${error.message}`);
    } else if (data) {
      setMensajes(data);
    }
  };

  useEffect(() => {
    if (!supabaseUrl || !supabaseKey) {
      setErrorMsg('Faltan las variables en .env.local (reiniciá npm run dev)');
      return;
    }

    cargarMensajes();

    // Escuchar cambios en tiempo real
    const canal = supabase
      .channel('mensajes-web')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensajes' }, () => {
        cargarMensajes();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  const enviarMensaje = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoTexto.trim()) return;
    setCargando(true);
    setErrorMsg(null);

    const { error } = await supabase
      .from('mensajes')
      .insert([{ texto: nuevoTexto, origen: 'Web' }]);

    if (error) {
      setErrorMsg(`Error al guardar: ${error.message}`);
    } else {
      setNuevoTexto('');
      await cargarMensajes();
    }
    setCargando(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 py-10 px-4">
      <main className="max-w-lg mx-auto bg-white p-6 rounded-xl shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Mensajes - Web</h1>
          <button
            onClick={cargarMensajes}
            className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-1 rounded"
          >
            Refrescar
          </button>
        </div>

        {errorMsg && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4 text-sm">
            {errorMsg}
          </div>
        )}

        <form onSubmit={enviarMensaje} className="flex gap-2 mb-6">
          <input
            type="text"
            value={nuevoTexto}
            onChange={(e) => setNuevoTexto(e.target.value)}
            placeholder="Escribí un mensaje..."
            className="border border-gray-300 bg-white text-gray-900 p-2.5 rounded-lg flex-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={cargando}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-lg disabled:opacity-50"
          >
            {cargando ? '...' : 'Enviar'}
          </button>
        </form>

        <div className="space-y-2">
          {mensajes.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No hay mensajes todavía.</p>
          ) : (
            mensajes.map((m) => (
              <div
                key={m.id}
                className="border border-gray-200 bg-gray-50 p-3 rounded-lg flex justify-between items-center"
              >
                <span className="text-gray-900 font-medium">{m.texto}</span>
                <span className="text-xs font-semibold bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full">
                  {m.origen}
                </span>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}