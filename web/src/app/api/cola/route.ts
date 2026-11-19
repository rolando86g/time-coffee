import {
  colaEnMemoria,
  limpiarColaEnMemoria,
  prepararDiaDeServicio,
} from '@/lib/cola-en-memoria';

const sinCache = { 'Cache-Control': 'no-store, max-age=0' };

export async function GET() {
  const servicio = prepararDiaDeServicio();
  return Response.json(
    { turnos: colaEnMemoria.turnos, servicio },
    { headers: sinCache },
  );
}

export async function POST(request: Request) {
  const servicio = prepararDiaDeServicio();
  if (!servicio.abierto) {
    return Response.json(
      {
        error: 'El servicio está pausado. Consulta con la barista.',
        servicio,
      },
      { status: 423, headers: sinCache },
    );
  }

  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return Response.json(
      { error: 'No se pudo leer el pedido. Inténtalo nuevamente.' },
      { status: 400, headers: sinCache },
    );
  }

  if (
    typeof cuerpo !== 'object' ||
    cuerpo === null ||
    !('nombre' in cuerpo) ||
    typeof cuerpo.nombre !== 'string'
  ) {
    return Response.json(
      { error: 'Escribe tu nombre para pedir un turno.' },
      { status: 400, headers: sinCache },
    );
  }

  const nombre = cuerpo.nombre.trim().replace(/\s+/g, ' ');
  if (!nombre || nombre.length > 50) {
    return Response.json(
      { error: 'El nombre debe tener entre 1 y 50 caracteres.' },
      { status: 400, headers: sinCache },
    );
  }

  const turno = {
    id: colaEnMemoria.siguienteNumero,
    numero: colaEnMemoria.siguienteNumero,
    nombre,
    creadoEn: new Date().toISOString(),
  };
  colaEnMemoria.siguienteNumero += 1;
  colaEnMemoria.turnos.push(turno);

  return Response.json(
    { turno },
    { status: 201, headers: sinCache },
  );
}

export async function DELETE(request: Request) {
  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return Response.json(
      { error: 'No se pudo identificar el turno.' },
      { status: 400, headers: sinCache },
    );
  }

  if (
    typeof cuerpo !== 'object' ||
    cuerpo === null ||
    !('numero' in cuerpo) ||
    typeof cuerpo.numero !== 'number' ||
    !Number.isSafeInteger(cuerpo.numero)
  ) {
    return Response.json(
      { error: 'El número de turno no es válido.' },
      { status: 400, headers: sinCache },
    );
  }

  const indice = colaEnMemoria.turnos.findIndex(
    (turno) => turno.numero === cuerpo.numero,
  );
  if (indice === -1) {
    return Response.json(
      { error: 'Ese turno ya no está en la cola.' },
      { status: 404, headers: sinCache },
    );
  }

  const [turno] = colaEnMemoria.turnos.splice(indice, 1);
  return Response.json({ turno }, { headers: sinCache });
}

export async function PATCH(request: Request) {
  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return Response.json(
      { error: 'No se pudo interpretar la acción.' },
      { status: 400, headers: sinCache },
    );
  }

  if (
    typeof cuerpo !== 'object' ||
    cuerpo === null ||
    !('accion' in cuerpo) ||
    cuerpo.accion !== 'limpiar'
  ) {
    return Response.json(
      { error: 'La acción solicitada no es válida.' },
      { status: 400, headers: sinCache },
    );
  }

  limpiarColaEnMemoria();
  return Response.json(
    { ok: true, turnos: colaEnMemoria.turnos, servicio: prepararDiaDeServicio() },
    { headers: sinCache },
  );
}
