'use client';

import { useCallback, useEffect, useState } from 'react';

type Turno = {
  id: number;
  numero: number;
  nombre: string;
  creadoEn: string;
};

type EstadoServicio = {
  abierto: boolean;
  momento: 'deshabilitado' | 'abierto';
  fecha: string;
  hora: string;
};

export default function BaristaPage() {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [servicio, setServicio] = useState<EstadoServicio | null>(null);
  const [conectada, setConectada] = useState(false);
  const [atendiendo, setAtendiendo] = useState(false);
  const [limpiando, setLimpiando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actualizarCola = useCallback(async (signal?: AbortSignal) => {
    try {
      const respuesta = await fetch('/api/cola', {
        cache: 'no-store',
        signal,
      });
      if (!respuesta.ok) throw new Error('No se pudo cargar la cola.');
      const resultado: { turnos: Turno[]; servicio: EstadoServicio } =
        await respuesta.json();
      setTurnos(resultado.turnos);
      setServicio(resultado.servicio);
      setConectada(true);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
      setConectada(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let intervalo: number;
    const sincronizar = async () => {
      await actualizarCola(controller.signal);
      if (!controller.signal.aborted) {
        intervalo = window.setTimeout(() => void sincronizar(), 1500);
      }
    };
    const inicio = window.setTimeout(() => void sincronizar(), 0);

    return () => {
      controller.abort();
      window.clearTimeout(inicio);
      window.clearTimeout(intervalo);
    };
  }, [actualizarCola]);

  const siguiente = turnos[0];
  const restantes = turnos.slice(1);

  const marcarAtendido = async () => {
    if (!siguiente || atendiendo) return;

    setAtendiendo(true);
    setError(null);
    try {
      const respuesta = await fetch('/api/cola', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero: siguiente.numero }),
        cache: 'no-store',
      });
      if (!respuesta.ok) {
        const resultado: { error?: string } = await respuesta.json();
        throw new Error(resultado.error ?? 'No se pudo avanzar la cola.');
      }

      setTurnos((actuales) =>
        actuales.filter((turno) => turno.numero !== siguiente.numero),
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'No se pudo avanzar la cola. Inténtalo nuevamente.',
      );
      void actualizarCola();
    } finally {
      setAtendiendo(false);
    }
  };

  const limpiarCola = async () => {
    if (limpiando) return;
    const confirmado = window.confirm(
      '¿Limpiar todos los turnos y reiniciar la numeración en #1? Esta acción no se puede deshacer.',
    );
    if (!confirmado) return;

    setLimpiando(true);
    setError(null);
    try {
      const respuesta = await fetch('/api/cola', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accion: 'limpiar' }),
        cache: 'no-store',
      });
      if (!respuesta.ok) {
        const resultado: { error?: string } = await respuesta.json();
        throw new Error(resultado.error ?? 'No se pudo limpiar la cola.');
      }

      const resultado: { turnos: Turno[]; servicio: EstadoServicio } =
        await respuesta.json();
      setTurnos(resultado.turnos);
      setServicio(resultado.servicio);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'No se pudo limpiar la cola. Inténtalo nuevamente.',
      );
    } finally {
      setLimpiando(false);
    }
  };

  return (
    <main className="barista-page">
      <header className="barista-header">
        <div className="barista-brand">
          <span className="kiosk-brand-mark">tc</span>
          <span>
            <strong>TIME COFFEE</strong>
            <small>Panel de barista</small>
          </span>
        </div>
        <div className="barista-live">
          <span className={`barista-live-dot ${conectada ? 'is-live' : ''}`} />
          {conectada ? 'Lista en vivo' : 'Reconectando…'}
        </div>
      </header>

      <section className="barista-content">
        <div className="barista-heading">
          <p className="kiosk-eyebrow">COLA DE TURNOS</p>
          <h1>¡Ya casi sale!</h1>
          <p>Llámale por su nombre cuando llegue su turno.</p>
        </div>

        {servicio && !servicio.abierto && (
          <section className="barista-closing-banner" role="status">
            <div>
              <strong>
                Servicio pausado por configuración
              </strong>
              <p>
                El ingreso de turnos está deshabilitado por CAFE_TURNOS_HABILITADOS=false. Actívalo en la configuración del servidor y reinícialo para recibir nuevos pedidos.
              </p>
            </div>
          </section>
        )}

        {siguiente ? (
          <section className="barista-next" aria-label="Siguiente turno">
            <span className="barista-next-label">SIGUIENTE</span>
            <strong className="barista-next-number">#{siguiente.numero}</strong>
            <span className="barista-next-name">{siguiente.nombre}</span>
            <button
              type="button"
              onClick={() => void marcarAtendido()}
              disabled={atendiendo}
              className="barista-served-button"
            >
              {atendiendo
                ? 'Actualizando…'
                : '✓  Marcar pedido atendido · Llamar al siguiente'}
            </button>
            <span className="barista-served-hint">
              Presiona después de entregar este pedido para avanzar la fila.
            </span>
          </section>
        ) : (
          <section className="barista-empty">
            <span aria-hidden="true">☕</span>
            <h2>Esperando el próximo turno</h2>
            <p>Los nuevos nombres aparecerán aquí automáticamente.</p>
          </section>
        )}

        {error && (
          <p className="barista-error" role="alert">
            {error}
          </p>
        )}

        {restantes.length > 0 && (
          <section className="barista-queue">
            <div className="barista-queue-heading">
              <h2>Después</h2>
              <span>{restantes.length} en espera</span>
            </div>
            <ol>
              {restantes.map((turno) => (
                <li className="barista-queue-item" key={turno.id}>
                  <span className="barista-queue-number">#{turno.numero}</span>
                  <span className="barista-queue-name">{turno.nombre}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
        <button
          type="button"
          onClick={() => void limpiarCola()}
          disabled={limpiando}
          className="barista-reset-button"
        >
          {limpiando ? 'Limpiando…' : 'Limpiar cola y reiniciar en #1'}
        </button>
      </section>

      <footer className="barista-footer">
        Turnos en espera: <strong>{turnos.length}</strong>
      </footer>
    </main>
  );
}
