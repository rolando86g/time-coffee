'use client';

import { useEffect, useState, type FormEvent } from 'react';

const TECLAS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ñ'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

const TILDES = ['Á', 'É', 'Í', 'Ó', 'Ú'];
const SEGUNDOS_PARA_REINICIAR = 10;

type EstadoServicio = {
  abierto: boolean;
  momento: 'deshabilitado' | 'abierto';
  hora: string;
};

function capitalizarNombre(valor: string) {
  return valor
    .toLocaleLowerCase('es')
    .replace(/(^|\s)\p{L}/gu, (letra) => letra.toLocaleUpperCase('es'));
}

export default function PedirTurnoPage() {
  const [nombre, setNombre] = useState('');
  const [turnoAsignado, setTurnoAsignado] = useState<number | null>(null);
  const [segundosRestantes, setSegundosRestantes] = useState(SEGUNDOS_PARA_REINICIAR);
  const [servicio, setServicio] = useState<EstadoServicio | null>(null);
  const [errorServicio, setErrorServicio] = useState<string | null>(null);
  const [conectando, setConectando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let activo = true;
    let temporizador: number;
    const consultarServicio = async () => {
      try {
        const respuesta = await fetch('/api/cola', { cache: 'no-store' });
        if (!respuesta.ok) throw new Error('No se pudo consultar el horario.');
        const resultado: { servicio: EstadoServicio } = await respuesta.json();
        if (activo) {
          setServicio(resultado.servicio);
          setErrorServicio(null);
          setConectando(false);
        }
      } catch {
        if (activo) {
          setErrorServicio('No se pudo conectar con la cafetería. Inténtalo nuevamente.');
          setConectando(false);
        }
      } finally {
        if (activo) {
          temporizador = window.setTimeout(() => void consultarServicio(), 5000);
        }
      }
    };
    const inicio = window.setTimeout(() => void consultarServicio(), 0);

    return () => {
      activo = false;
      window.clearTimeout(inicio);
      window.clearTimeout(temporizador);
    };
  }, []);

  useEffect(() => {
    if (turnoAsignado === null) return;
    const venceEn = Date.now() + SEGUNDOS_PARA_REINICIAR * 1000;
    const temporizador = window.setInterval(() => {
      const restantes = Math.max(0, Math.ceil((venceEn - Date.now()) / 1000));
      setSegundosRestantes(restantes);
      if (restantes === 0) {
        setTurnoAsignado(null);
        setSegundosRestantes(SEGUNDOS_PARA_REINICIAR);
      }
    }, 1000);
    return () => window.clearInterval(temporizador);
  }, [turnoAsignado]);

  const agregarLetra = (letra: string) => {
    if (nombre.length >= 50) return;
    setNombre((actual) => capitalizarNombre(`${actual}${letra.toLocaleLowerCase('es')}`));
    setError(null);
  };

  const pedirTurno = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nombreLimpio = nombre.trim().replace(/\s+/g, ' ');
    if (!nombreLimpio || enviando) return;

    setEnviando(true);
    setError(null);
    try {
      const respuesta = await fetch('/api/cola', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombreLimpio }),
        cache: 'no-store',
      });
      const resultado: { turno?: { numero: number }; error?: string } =
        await respuesta.json();

      if (!respuesta.ok || !resultado.turno) {
        setError(resultado.error ?? 'No se pudo pedir el turno. Inténtalo nuevamente.');
        return;
      }

      setTurnoAsignado(resultado.turno.numero);
      setSegundosRestantes(SEGUNDOS_PARA_REINICIAR);
      setNombre('');
    } catch {
      setError('No se pudo conectar. Verifica la conexión e inténtalo nuevamente.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <main className="kiosk-page">
      <section
        className={`kiosk-card${turnoAsignado !== null ? ' kiosk-card-with-ticket' : ''}`}
      >
        <div className="kiosk-brand">
          <span className="kiosk-brand-mark">tc</span>
          <span>TIME COFFEE</span>
        </div>

        <p className="kiosk-eyebrow">BIENVENIDO/A</p>
        <h1 className="kiosk-title">Pide tu turno</h1>
        <p className="kiosk-description">
          Escribe tu nombre y la barista te llamará cuando sea tu turno.
        </p>

        {turnoAsignado !== null && (
          <div className="kiosk-ticket" role="status" aria-live="polite">
            <span className="kiosk-ticket-label">TU TURNO</span>
            <strong>#{turnoAsignado}</strong>
            <span>¡Gracias! Estate atento/a a tu nombre.</span>
            <span className="kiosk-ticket-countdown">
              Este comprobante desaparecerá en {segundosRestantes} segundos.
            </span>
          </div>
        )}

        {conectando ? (
          <div className="kiosk-closed" role="status">
            <strong>Conectando con la cafetería…</strong>
          </div>
        ) : errorServicio ? (
          <div className="kiosk-closed" role="alert">
            <strong>No se pudo consultar el servicio</strong>
            <span>{errorServicio}</span>
          </div>
        ) : servicio && !servicio.abierto ? (
          <div className="kiosk-closed" role="status">
            <strong>Servicio temporalmente pausado</strong>
            <span>Consulta con la barista para saber cuándo volverá a estar disponible.</span>
          </div>
        ) : (
        <form onSubmit={pedirTurno} className="kiosk-form">
          <label htmlFor="nombre-cliente" className="kiosk-label">
            Tu nombre
          </label>
          <input
            id="nombre-cliente"
            className="kiosk-name-input"
            value={nombre}
            onChange={(event) => {
              setNombre(capitalizarNombre(event.target.value.slice(0, 50)));
              setError(null);
            }}
            placeholder="Toca las letras para escribir"
            autoComplete="off"
            maxLength={50}
          />

          <div className="touch-keyboard" aria-label="Teclado en pantalla">
            {TECLAS.map((fila, indice) => (
              <div className="touch-keyboard-row" key={indice}>
                {fila.map((tecla) => (
                  <button
                    className="touch-key"
                    key={tecla}
                    type="button"
                    onClick={() => agregarLetra(tecla)}
                    aria-label={tecla}
                  >
                    {tecla}
                  </button>
                ))}
              </div>
            ))}
            <div className="touch-keyboard-row touch-keyboard-extras">
              {TILDES.map((tecla) => (
                <button
                  className="touch-key touch-key-small"
                  key={tecla}
                  type="button"
                  onClick={() => agregarLetra(tecla)}
                  aria-label={tecla}
                >
                  {tecla}
                </button>
              ))}
              <button
                className="touch-key touch-key-space"
                type="button"
                onClick={() => {
                  if (nombre && !nombre.endsWith(' ')) setNombre(`${nombre} `);
                }}
                aria-label="Espacio"
              >
                Espacio
              </button>
              <button
                className="touch-key touch-key-edit"
                type="button"
                onClick={() => setNombre((actual) => actual.slice(0, -1))}
                aria-label="Borrar última letra"
              >
                Borrar
              </button>
            </div>
          </div>

          {error && (
            <p className="kiosk-error" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="kiosk-submit"
            disabled={!nombre.trim() || enviando || !servicio?.abierto}
          >
            {enviando ? 'Pidiendo turno…' : 'Pedir turno'}
          </button>
        </form>
        )}

        <p className="kiosk-footer">
          Disponible todo el día · {servicio?.hora ?? '--:--'} (Buenos Aires)
        </p>
      </section>
    </main>
  );
}
