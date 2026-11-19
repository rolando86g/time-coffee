export type TurnoEnMemoria = {
  id: number;
  numero: number;
  nombre: string;
  creadoEn: string;
};

export type EstadoServicio = {
  abierto: boolean;
  momento: 'deshabilitado' | 'abierto';
  fecha: string;
  hora: string;
};

type ColaEnMemoria = {
  siguienteNumero: number;
  turnos: TurnoEnMemoria[];
  fechaServicio: string;
};

export const ZONA_HORARIA_CAFETERIA = 'America/Argentina/Buenos_Aires';

function turnosHabilitados() {
  const valor = process.env.CAFE_TURNOS_HABILITADOS;
  if (valor === undefined) return true;

  const normalizado = valor.trim().toLowerCase();
  if (normalizado === 'true') return true;
  if (normalizado === 'false') return false;
  throw new Error('CAFE_TURNOS_HABILITADOS debe ser true o false.');
}

function partesLocales(fecha: Date) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA_CAFETERIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(fecha);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value ?? '';
  const anio = valor('year');
  const mes = valor('month');
  const dia = valor('day');
  const hora = valor('hour');
  const minuto = valor('minute');
  return {
    fecha: `${anio}-${mes}-${dia}`,
    hora: `${hora}:${minuto}`,
  };
}

export function estadoServicio(fecha = new Date()): EstadoServicio {
  const local = partesLocales(fecha);
  if (!turnosHabilitados()) {
    return {
      abierto: false,
      momento: 'deshabilitado',
      fecha: local.fecha,
      hora: local.hora,
    };
  }

  return {
    abierto: true,
    momento: 'abierto',
    fecha: local.fecha,
    hora: local.hora,
  };
}

const globalConCola = globalThis as typeof globalThis & {
  timeCoffeeCola?: ColaEnMemoria;
};

export const colaEnMemoria =
  globalConCola.timeCoffeeCola ??
  (globalConCola.timeCoffeeCola = {
    siguienteNumero: 1,
    turnos: [],
    fechaServicio: partesLocales(new Date()).fecha,
  });

export function prepararDiaDeServicio(ahora = new Date()) {
  const servicio = estadoServicio(ahora);
  if (colaEnMemoria.fechaServicio !== servicio.fecha) {
    colaEnMemoria.turnos = [];
    colaEnMemoria.siguienteNumero = 1;
    colaEnMemoria.fechaServicio = servicio.fecha;
  }
  return servicio;
}

export function limpiarColaEnMemoria() {
  colaEnMemoria.turnos = [];
  colaEnMemoria.siguienteNumero = 1;
}
