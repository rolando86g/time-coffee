'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { createClient, type User } from '@supabase/supabase-js';

type EstadoTurno = 'pendiente' | 'preparando' | 'listo' | 'entregado';

type Turno = {
  id: number;
  numero_turno: number;
  nombre_cafe: string;
  estado: EstadoTurno;
  usuario_id: string | null;
  cliente_email: string | null;
  created_at: string;
};

type Rol = 'admin' | 'user';
type PerfilCargado = {
  userId: string;
  role: Rol | null;
};

const TURNOS_POR_PAGINA = 100;
const CAFES_SUGERIDOS = ['Espresso', 'Americano', 'Latte', 'Capuccino', 'Flat white', 'Mocaccino'];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const nombreEstado: Record<EstadoTurno, string> = {
  pendiente: 'Pendiente',
  preparando: 'Preparando',
  listo: 'Listo para retirar',
  entregado: 'Entregado',
};

function mensajeDeError(error: unknown) {
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
}

function fechaLegible(fecha: string) {
  return new Intl.DateTimeFormat('es', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(fecha));
}

export default function Home() {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<PerfilCargado | null>(null);
  const usuarioActualId = useRef<string | null>(null);
  const estadosPrevios = useRef(new Map<number, EstadoTurno>());
  const estadosInicializados = useRef(false);
  const [sesionCargando, setSesionCargando] = useState(Boolean(supabase));
  const [modo, setModo] = useState<'ingresar' | 'registrar'>('ingresar');
  const [email, setEmail] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [nombreCafe, setNombreCafe] = useState('');
  const [authCargando, setAuthCargando] = useState(false);
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [turnosCargando, setTurnosCargando] = useState(false);
  const [pidiendoTurno, setPidiendoTurno] = useState(false);
  const [turnoEnProceso, setTurnoEnProceso] = useState<number | null>(null);
  const [realtimeConectado, setRealtimeConectado] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(
    supabase
      ? null
      : 'Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
  );
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const usuarioId = usuario?.id;
  const perfilActual = usuarioId && perfil?.userId === usuarioId ? perfil : null;
  const rol = perfilActual?.role ?? null;
  const perfilCargando = Boolean(usuario && !perfilActual);
  const esAdmin = rol === 'admin';

  useEffect(() => {
    if (!supabase) return;

    let activo = true;
    let eventoAuthRecibido = false;
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!activo || eventoAuthRecibido) return;
        if (error) setErrorMsg(`No se pudo recuperar la sesión: ${error.message}`);
        const siguienteUsuario = data.session?.user ?? null;
        usuarioActualId.current = siguienteUsuario?.id ?? null;
        if (siguienteUsuario) setTurnosCargando(true);
        setUsuario(siguienteUsuario);
        setSesionCargando(false);
      })
      .catch((error: unknown) => {
        if (!activo || eventoAuthRecibido) return;
        setErrorMsg(`No se pudo recuperar la sesión: ${mensajeDeError(error)}`);
        setSesionCargando(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      eventoAuthRecibido = true;
      const siguienteUsuario = session?.user ?? null;
      const siguienteId = siguienteUsuario?.id ?? null;
      if (usuarioActualId.current !== siguienteId) {
        usuarioActualId.current = siguienteId;
        estadosPrevios.current.clear();
        estadosInicializados.current = false;
        setPerfil(null);
        setTurnos([]);
        setTurnosCargando(Boolean(siguienteUsuario));
        setRealtimeConectado(false);
      }
      setUsuario(siguienteUsuario);
      setSesionCargando(false);
    });

    return () => {
      activo = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !usuarioId) return;

    let activo = true;
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', usuarioId)
          .single();

        if (!activo) return;
        if (error) {
          setPerfil({ userId: usuarioId, role: null });
          setErrorMsg(`No se pudo verificar tu rol: ${error.message}`);
        } else if (data.role === 'admin' || data.role === 'user') {
          setPerfil({ userId: usuarioId, role: data.role });
          setErrorMsg(null);
        } else {
          setPerfil({ userId: usuarioId, role: null });
          setErrorMsg('El perfil no tiene un rol válido. Contacta al administrador.');
        }
      } catch (error: unknown) {
        if (!activo) return;
        setPerfil({ userId: usuarioId, role: null });
        setErrorMsg(`No se pudo verificar tu rol: ${mensajeDeError(error)}`);
      }
    })();

    return () => {
      activo = false;
    };
  }, [usuarioId]);

  const obtenerTurnos = useCallback(async () => {
    if (!supabase || !usuarioId || !rol) return [];

    const crearConsulta = () =>
      supabase
        .from('turnos')
        .select('id, numero_turno, nombre_cafe, estado, usuario_id, cliente_email, created_at')
        .order('numero_turno', { ascending: esAdmin });

    if (!esAdmin) {
      const { data, error } = await crearConsulta()
        .eq('usuario_id', usuarioId)
        .limit(10);
      if (error) throw new Error(`Error al leer tus turnos: ${error.message}`);
      return (data ?? []) as Turno[];
    }

    const todosLosTurnos: Turno[] = [];
    for (let desde = 0; ; desde += TURNOS_POR_PAGINA) {
      const { data, error } = await crearConsulta()
        .neq('estado', 'entregado')
        .range(desde, desde + TURNOS_POR_PAGINA - 1);
      if (error) throw new Error(`Error al leer la cola: ${error.message}`);
      todosLosTurnos.push(...((data ?? []) as Turno[]));
      if (!data || data.length < TURNOS_POR_PAGINA) return todosLosTurnos;
    }
  }, [esAdmin, rol, usuarioId]);

  const aplicarTurnos = useCallback(
    (lista: Turno[], notificarCambios: boolean) => {
      if (!esAdmin && notificarCambios && estadosInicializados.current) {
        for (const turno of lista) {
          if (
            turno.estado === 'listo' &&
            estadosPrevios.current.get(turno.id) !== 'listo'
          ) {
            setInfoMsg(`¡Tu ${turno.nombre_cafe} está listo para retirar! Turno #${turno.numero_turno}.`);
            if (
              typeof window !== 'undefined' &&
              'Notification' in window &&
              Notification.permission === 'granted'
            ) {
              new Notification('¡Tu café está listo!', {
                body: `Turno #${turno.numero_turno} · ${turno.nombre_cafe}`,
              });
            }
          }
        }
      }

      estadosPrevios.current = new Map(
        lista.map((turno) => [turno.id, turno.estado]),
      );
      estadosInicializados.current = true;
      setTurnos(lista);
    },
    [esAdmin],
  );

  const cargarTurnos = useCallback(async (notificarCambios = false) => {
    setTurnosCargando(true);
    try {
      aplicarTurnos(await obtenerTurnos(), notificarCambios);
    } catch (error: unknown) {
      setErrorMsg(mensajeDeError(error));
    } finally {
      setTurnosCargando(false);
    }
  }, [aplicarTurnos, obtenerTurnos]);

  useEffect(() => {
    if (!supabase || !usuarioId || !rol) return;

    let activo = true;
    void (async () => {
      try {
        const lista = await obtenerTurnos();
        if (activo) aplicarTurnos(lista, false);
      } catch (error: unknown) {
        if (activo) setErrorMsg(mensajeDeError(error));
      } finally {
        if (activo) setTurnosCargando(false);
      }
    })();

    const canal = supabase
      .channel(`turnos-${usuarioId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'turnos' },
        () => {
          if (activo) void cargarTurnos(true);
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeConectado(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeConectado(false);
          setErrorMsg('No se pudo conectar con las actualizaciones en tiempo real.');
        } else if (status === 'CLOSED') {
          setRealtimeConectado(false);
        }
      });

    return () => {
      activo = false;
      setRealtimeConectado(false);
      void supabase.removeChannel(canal);
    };
  }, [usuarioId, rol, obtenerTurnos, aplicarTurnos, cargarTurnos]);

  const enviarAutenticacion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supabase) {
      setErrorMsg('Falta configurar la conexión con Supabase.');
      return;
    }

    setAuthCargando(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      const correo = email.trim().toLowerCase();
      if (modo === 'registrar') {
        const { data, error } = await supabase.auth.signUp({
          email: correo,
          password: contrasena,
        });
        if (error) {
          setErrorMsg(`No se pudo crear la cuenta: ${error.message}`);
        } else if (data.session) {
          setInfoMsg('Tu cuenta fue creada y ya puedes pedir tu café.');
          setContrasena('');
        } else {
          setInfoMsg('Cuenta creada. Confirma tu correo antes de iniciar sesión.');
          setContrasena('');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: correo,
          password: contrasena,
        });
        if (error) {
          setErrorMsg(`No se pudo iniciar sesión: ${error.message}`);
        } else {
          setInfoMsg('Iniciaste sesión correctamente.');
          setContrasena('');
        }
      }
    } catch (error: unknown) {
      setErrorMsg(mensajeDeError(error));
    } finally {
      setAuthCargando(false);
    }
  };

  const cerrarSesion = async () => {
    if (!supabase) return;
    setAuthCargando(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) setErrorMsg(`No se pudo cerrar sesión: ${error.message}`);
      else setInfoMsg('Sesión cerrada.');
    } catch (error: unknown) {
      setErrorMsg(mensajeDeError(error));
    } finally {
      setAuthCargando(false);
    }
  };

  const pedirTurno = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cafe = nombreCafe.trim();
    if (!supabase || !usuario || !cafe) return;

    setPidiendoTurno(true);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      const { error } = await supabase.from('turnos').insert({
        nombre_cafe: cafe,
        estado: 'pendiente',
        usuario_id: usuario.id,
        cliente_email: usuario.email,
      });
      if (error) {
        setErrorMsg(`No se pudo pedir el turno: ${error.message}`);
      } else {
        setNombreCafe('');
        setInfoMsg('Tu turno fue creado. Te avisaremos cuando tu café esté listo.');
        await cargarTurnos();
      }
    } catch (error: unknown) {
      setErrorMsg(`No se pudo pedir el turno: ${mensajeDeError(error)}`);
    } finally {
      setPidiendoTurno(false);
    }
  };

  const cambiarEstado = async (turno: Turno, estado: EstadoTurno) => {
    if (!supabase || !esAdmin) return;

    setTurnoEnProceso(turno.id);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      const { error } = await supabase
        .from('turnos')
        .update({ estado })
        .eq('id', turno.id);
      if (error) {
        setErrorMsg(`No se pudo actualizar el turno: ${error.message}`);
      } else {
        setInfoMsg(
          estado === 'entregado'
            ? `Turno #${turno.numero_turno} entregado y archivado.`
            : `Turno #${turno.numero_turno}: ${nombreEstado[estado].toLowerCase()}.`,
        );
        await cargarTurnos();
      }
    } catch (error: unknown) {
      setErrorMsg(`No se pudo actualizar el turno: ${mensajeDeError(error)}`);
    } finally {
      setTurnoEnProceso(null);
    }
  };

  const activarNotificaciones = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setInfoMsg('Este navegador no admite notificaciones de escritorio.');
      return;
    }

    try {
      if (Notification.permission === 'granted') {
        setInfoMsg('Las notificaciones del navegador ya están activadas.');
        return;
      }
      const permiso = await Notification.requestPermission();
      setInfoMsg(
        permiso === 'granted'
          ? 'Notificaciones activadas. Te avisaremos cuando tu café esté listo.'
          : 'Las notificaciones están desactivadas. Verás el aviso dentro de la aplicación.',
      );
    } catch (error: unknown) {
      setErrorMsg(`No se pudieron activar las notificaciones: ${mensajeDeError(error)}`);
    }
  };

  const cargandoAplicacion = sesionCargando || perfilCargando;

  return (
    <main className="min-h-screen px-4 pb-14 pt-5 text-stone-900 sm:px-6 sm:pt-8">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="ambient-orb ambient-orb-one" />
        <div className="ambient-orb ambient-orb-two" />
      </div>

      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex items-center justify-between">
          <Link href="/" className="group inline-flex items-center gap-3" aria-label="Time Coffee, inicio">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-stone-900 text-lg font-bold text-amber-100 shadow-lg shadow-stone-900/10 transition-transform group-hover:-rotate-6">
              tc
            </span>
            <span>
              <span className="block text-base font-bold tracking-tight">time coffee</span>
              <span className="block text-xs text-stone-500">turnos simples, buen café</span>
            </span>
          </Link>

          {usuario && !cargandoAplicacion && (
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="max-w-48 truncate text-sm font-semibold">{usuario.email}</p>
                <p className="text-xs capitalize text-stone-500">
                  {esAdmin ? 'Administrador' : 'Cliente'}
                </p>
              </div>
              <button
                type="button"
                onClick={cerrarSesion}
                disabled={authCargando}
                className="button-secondary"
              >
                Cerrar sesión
              </button>
            </div>
          )}
        </header>

        {errorMsg && (
          <p role="alert" className="notice-error mb-6">
            {errorMsg}
          </p>
        )}
        {infoMsg && (
          <p role="status" className="notice-success mb-6">
            {infoMsg}
          </p>
        )}

        {cargandoAplicacion ? (
          <section className="surface-card mx-auto max-w-xl p-10 text-center">
            <span className="loading-dot mx-auto mb-4 block" />
            <p className="font-medium text-stone-600">Preparando tu espacio...</p>
          </section>
        ) : !usuario ? (
          <section className="mx-auto grid max-w-5xl overflow-hidden rounded-[2rem] border border-white/80 bg-white/80 shadow-2xl shadow-stone-900/5 backdrop-blur-xl md:grid-cols-[1.05fr_0.95fr]">
            <div className="auth-hero relative flex min-h-72 flex-col justify-between overflow-hidden p-8 text-white sm:p-12">
              <div className="relative z-10">
                <span className="mb-8 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium tracking-wide text-amber-100">
                  TU CAFÉ, A TU TIEMPO
                </span>
                <h1 className="max-w-md text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
                  Pide tu café. Sigue tu turno.
                </h1>
                <p className="mt-4 max-w-sm text-sm leading-6 text-white/70 sm:text-base">
                  Haz tu pedido y recibe una notificación cuando esté listo para retirar.
                </p>
              </div>
              <div className="relative z-10 mt-12 flex items-center gap-2 text-sm text-white/60">
                <span className="size-2 rounded-full bg-emerald-300" />
                Sin filas, sin perder tu turno
              </div>
              <div className="auth-glow" aria-hidden="true" />
            </div>

            <div className="p-7 sm:p-12">
              <p className="eyebrow mb-3">BIENVENIDO A TIME COFFEE</p>
              <h2 className="text-3xl font-semibold tracking-tight">
                {modo === 'ingresar' ? 'Qué bueno verte.' : 'Crea tu cuenta.'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-stone-500">
                {modo === 'ingresar'
                  ? 'Ingresa para pedir y seguir tu café.'
                  : 'Regístrate con tu correo para pedir tu primer café.'}
              </p>

              <form onSubmit={enviarAutenticacion} className="mt-8 space-y-5">
                <label className="field-label">
                  Correo electrónico
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="field-input"
                    placeholder="tu@correo.com"
                  />
                </label>

                <label className="field-label">
                  Contraseña
                  <input
                    type="password"
                    autoComplete={modo === 'ingresar' ? 'current-password' : 'new-password'}
                    required
                    minLength={6}
                    value={contrasena}
                    onChange={(event) => setContrasena(event.target.value)}
                    className="field-input"
                    placeholder="Mínimo 6 caracteres"
                  />
                </label>

                <button
                  type="submit"
                  disabled={authCargando || !supabase}
                  className="button-primary w-full"
                >
                  {authCargando
                    ? 'Un momento...'
                    : modo === 'ingresar'
                      ? 'Iniciar sesión'
                      : 'Crear cuenta'}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-stone-500">
                {modo === 'ingresar' ? '¿Todavía no tienes cuenta?' : '¿Ya tienes una cuenta?'}{' '}
                <button
                  type="button"
                  onClick={() => {
                    setModo(modo === 'ingresar' ? 'registrar' : 'ingresar');
                    setErrorMsg(null);
                    setInfoMsg(null);
                  }}
                  className="font-semibold text-amber-800 transition-colors hover:text-amber-950"
                >
                  {modo === 'ingresar' ? 'Regístrate' : 'Inicia sesión'}
                </button>
              </p>
            </div>
          </section>
        ) : !rol ? (
          <section className="surface-card mx-auto max-w-xl p-8 text-center sm:p-12">
            <p className="eyebrow mb-3">PERFIL DE CUENTA</p>
            <h1 className="text-2xl font-semibold tracking-tight">No pudimos cargar tu perfil</h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-stone-500">
              Para continuar necesitamos verificar tu rol en Supabase. Comprueba que exista tu
              registro en <code>public.profiles</code>.
            </p>
            <button type="button" onClick={cerrarSesion} className="button-secondary mt-6">
              Cerrar sesión
            </button>
          </section>
        ) : (
          <div className="animate-in">
            <section className="mb-7 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className={esAdmin ? 'badge-admin' : 'badge-user'}>
                    {esAdmin ? 'PANEL DE CAFETERÍA' : 'TU PEDIDO'}
                  </span>
                  <span className="inline-flex items-center gap-2 text-xs text-stone-500">
                    <span
                      className={`size-2 rounded-full ${realtimeConectado ? 'bg-emerald-500' : 'bg-stone-300'}`}
                    />
                    {realtimeConectado ? 'Actualizado en vivo' : 'Conectando...'}
                  </span>
                </div>
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  {esAdmin ? 'Cola de pedidos' : 'Tu café, sin esperar de más.'}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500 sm:text-base">
                  {esAdmin
                    ? 'Prepara los pedidos en orden y avisa cuando estén listos.'
                    : 'Pide tu café y sigue el estado de tu turno en tiempo real.'}
                </p>
              </div>

              {!esAdmin && (
                <button
                  type="button"
                  onClick={activarNotificaciones}
                  className="button-secondary self-start sm:self-auto"
                >
                  Activar avisos del navegador
                </button>
              )}
            </section>

            {esAdmin ? (
              <>
                <section aria-label="Resumen de pedidos" className="mb-7 grid gap-4 sm:grid-cols-3">
                  {(['pendiente', 'preparando', 'listo'] as const).map((estado) => (
                    <div key={estado} className="stat-card">
                      <span className={`stat-icon ${estado === 'preparando' ? 'stat-icon-green' : estado === 'listo' ? 'stat-icon-blue' : ''}`}>
                        {estado === 'pendiente' ? '01' : estado === 'preparando' ? '02' : '03'}
                      </span>
                      <div>
                        <p className="text-sm text-stone-500">{nombreEstado[estado]}</p>
                        <p className="mt-1 text-2xl font-semibold tracking-tight">
                          {turnos.filter((turno) => turno.estado === estado).length}
                        </p>
                      </div>
                    </div>
                  ))}
                </section>

                <section className="surface-card overflow-hidden">
                  <div className="flex flex-col gap-3 border-b border-stone-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                    <div>
                      <p className="eyebrow">ORDEN ASCENDENTE</p>
                      <h2 className="mt-1 text-xl font-semibold tracking-tight">
                        Pedidos por preparar
                      </h2>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-stone-400">
                        {turnos.length} {turnos.length === 1 ? 'turno activo' : 'turnos activos'}
                      </span>
                      <button
                        type="button"
                        onClick={() => void cargarTurnos()}
                        disabled={turnosCargando}
                        className="button-secondary px-3 py-2"
                      >
                        {turnosCargando ? 'Actualizando...' : 'Actualizar'}
                      </button>
                    </div>
                  </div>

                  {turnosCargando && turnos.length === 0 ? (
                    <p className="p-10 text-center text-sm text-stone-500">Cargando pedidos...</p>
                  ) : turnos.length === 0 ? (
                    <div className="px-6 py-14 text-center">
                      <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-amber-50 text-lg font-bold text-amber-800">
                        tc
                      </span>
                      <h3 className="font-semibold">La cola está vacía</h3>
                      <p className="mt-1 text-sm text-stone-500">
                        Los nuevos pedidos aparecerán aquí en tiempo real.
                      </p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-stone-100">
                      {turnos.map((turno) => (
                        <li key={turno.id} className="order-row px-5 py-5 sm:px-7">
                          <div className="flex min-w-0 items-center gap-4">
                            <span className="turn-number">#{turno.numero_turno}</span>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-stone-800">
                                {turno.nombre_cafe}
                              </p>
                              <p className="mt-1 truncate text-xs text-stone-400">
                                {turno.cliente_email || 'Cliente'} · {fechaLegible(turno.created_at)}
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                            <span className={`status-pill status-${turno.estado}`}>
                              {nombreEstado[turno.estado]}
                            </span>
                            {turno.estado === 'pendiente' && (
                              <button
                                type="button"
                                disabled={turnoEnProceso !== null}
                                onClick={() => void cambiarEstado(turno, 'preparando')}
                                className="button-primary px-3 py-2 text-xs"
                              >
                                {turnoEnProceso === turno.id ? 'Guardando...' : 'Preparar'}
                              </button>
                            )}
                            {turno.estado === 'preparando' && (
                              <button
                                type="button"
                                disabled={turnoEnProceso !== null}
                                onClick={() => void cambiarEstado(turno, 'listo')}
                                className="button-primary px-3 py-2 text-xs"
                              >
                                {turnoEnProceso === turno.id ? 'Guardando...' : 'Marcar listo'}
                              </button>
                            )}
                            {turno.estado === 'listo' && (
                              <button
                                type="button"
                                disabled={turnoEnProceso !== null}
                                onClick={() => void cambiarEstado(turno, 'entregado')}
                                className="button-secondary px-3 py-2 text-xs"
                              >
                                {turnoEnProceso === turno.id ? 'Guardando...' : 'Entregar'}
                              </button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            ) : (
              <div className="grid items-start gap-6 lg:grid-cols-[0.85fr_1.15fr]">
                <section className="surface-card p-5 sm:p-7">
                  <p className="eyebrow">NUEVO PEDIDO</p>
                  <h2 className="mt-1 text-xl font-semibold tracking-tight">¿Qué café te preparamos?</h2>
                  <p className="mt-2 text-sm leading-6 text-stone-500">
                    Elige uno de la lista o escribe tu café favorito.
                  </p>
                  <form onSubmit={pedirTurno} className="mt-6 space-y-4">
                    <label htmlFor="nombre-cafe" className="field-label">
                      Nombre del café
                      <input
                        id="nombre-cafe"
                        list="cafes-sugeridos"
                        type="text"
                        required
                        maxLength={80}
                        value={nombreCafe}
                        onChange={(event) => setNombreCafe(event.target.value)}
                        className="field-input"
                        placeholder="Ej. Latte de avena"
                      />
                      <datalist id="cafes-sugeridos">
                        {CAFES_SUGERIDOS.map((cafe) => (
                          <option key={cafe} value={cafe} />
                        ))}
                      </datalist>
                    </label>
                    <button
                      type="submit"
                      disabled={pidiendoTurno || !nombreCafe.trim()}
                      className="button-primary w-full"
                    >
                      {pidiendoTurno ? 'Pidiendo turno...' : 'Pedir turno'}
                    </button>
                  </form>
                  <p className="mt-4 text-center text-xs text-stone-400">
                    Tu número se asigna automáticamente.
                  </p>
                </section>

                <section className="surface-card overflow-hidden">
                  <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-5 py-5 sm:px-7">
                    <div>
                      <p className="eyebrow">SEGUIMIENTO</p>
                      <h2 className="mt-1 text-xl font-semibold tracking-tight">Tus turnos</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => void cargarTurnos()}
                      disabled={turnosCargando}
                      className="button-secondary px-3 py-2"
                    >
                      Actualizar
                    </button>
                  </div>

                  {turnosCargando && turnos.length === 0 ? (
                    <p className="p-10 text-center text-sm text-stone-500">Buscando tus turnos...</p>
                  ) : turnos.length === 0 ? (
                    <div className="px-6 py-14 text-center">
                      <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-amber-50 text-lg font-bold text-amber-800">
                        tc
                      </span>
                      <h3 className="font-semibold">Todavía no tienes turnos</h3>
                      <p className="mt-1 text-sm text-stone-500">
                        Tu pedido y su estado aparecerán aquí.
                      </p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-stone-100">
                      {turnos.map((turno) => (
                        <li key={turno.id} className="px-5 py-5 sm:px-7">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex min-w-0 items-center gap-4">
                              <span className="turn-number">#{turno.numero_turno}</span>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-stone-800">
                                  {turno.nombre_cafe}
                                </p>
                                <p className="mt-1 text-xs text-stone-400">
                                  {fechaLegible(turno.created_at)}
                                </p>
                              </div>
                            </div>
                            <span className={`status-pill status-${turno.estado}`}>
                              {nombreEstado[turno.estado]}
                            </span>
                          </div>

                          {turno.estado !== 'entregado' && (
                            <div className="turn-progress mt-5" aria-label={`Estado: ${nombreEstado[turno.estado]}`}>
                              {(['pendiente', 'preparando', 'listo'] as const).map((estado) => {
                                const pasos = ['pendiente', 'preparando', 'listo'];
                                const actual = pasos.indexOf(turno.estado);
                                const indice = pasos.indexOf(estado);
                                return (
                                  <span
                                    key={estado}
                                    className={`turn-step ${indice <= actual ? 'turn-step-active' : ''}`}
                                    title={nombreEstado[estado]}
                                  />
                                );
                              })}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {turnos.some((turno) => turno.estado === 'listo') && (
                    <p className="border-t border-emerald-100 bg-emerald-50/70 px-5 py-3 text-sm font-medium text-emerald-800 sm:px-7">
                      ¡Tu café está listo! Puedes pasar a retirarlo.
                    </p>
                  )}
                </section>
              </div>
            )}

            <footer className="mt-6 flex flex-col items-center justify-between gap-2 px-1 text-xs text-stone-400 sm:flex-row">
              <span>Un café a la vez.</span>
              <span>Time Coffee · {realtimeConectado ? 'En tiempo real' : 'Conectando'}</span>
            </footer>
          </div>
        )}
      </div>
    </main>
  );
}
