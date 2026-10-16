import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const API = "http://localhost:3000";

type Id = number | string;

interface Departamento {
  id: Id;
  nombre: string;
}

interface Empleado {
  id: Id;
  nombre: string;
  departamentoId: Id;
}


async function request<T>(ruta: string, opciones?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${ruta}`, {
      headers: { "Content-Type": "application/json" },
      ...opciones,
    });
  } catch {
    throw new Error(
      `No se pudo conectar con ${API}. ¿Está json-server en marcha?`,
    );
  }
  if (res.status === 404) throw new Error("No encontrado (404).");
  if (!res.ok) throw new Error(`Error HTTP ${res.status}.`);
  return (await res.json()) as T;
}


const api = {
  departamentos: {
    listar: () => request<Departamento[]>("/departamentos"),
    obtener: (id: Id) => request<Departamento>(`/departamentos/${id}`),
    crear: (nombre: string) =>
      request<Departamento>("/departamentos", {
        method: "POST",
        body: JSON.stringify({ nombre }),
      }),
    actualizar: (id: Id, nombre: string) =>
      request<Departamento>(`/departamentos/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ nombre }),
      }),
    eliminar: (id: Id) =>
      request<unknown>(`/departamentos/${id}`, { method: "DELETE" }),
  },
  empleados: {
    listar: (departamentoId?: Id) =>
      request<Empleado[]>(
        departamentoId !== undefined
          ? `/empleados?departamentoId=${departamentoId}`
          : "/empleados",
      ),
    obtener: (id: Id) => request<Empleado>(`/empleados/${id}`),
    crear: (nombre: string, departamentoId: Id) =>
      request<Empleado>("/empleados", {
        method: "POST",
        body: JSON.stringify({ nombre, departamentoId }),
      }),
    actualizar: (id: Id, cambios: Partial<Omit<Empleado, "id">>) =>
      request<Empleado>(`/empleados/${id}`, {
        method: "PATCH",
        body: JSON.stringify(cambios),
      }),
    eliminar: (id: Id) =>
      request<unknown>(`/empleados/${id}`, { method: "DELETE" }),
  },
};


const rl = readline.createInterface({ input, output });

async function preguntar(texto: string): Promise<string> {
  return (await rl.question(texto)).trim();
}

async function pedirTexto(texto: string): Promise<string> {
  while (true) {
    const valor = await preguntar(texto);
    if (valor) return valor;
    console.log("  El valor no puede estar vacío.");
  }
}

async function pedirId(texto: string): Promise<Id> {
  return pedirTexto(texto);
}

async function confirmar(texto: string): Promise<boolean> {
  const r = (await preguntar(`${texto} (s/n): `)).toLowerCase();
  return r === "s" || r === "si" || r === "sí";
}

async function mostrarDepartamentos(): Promise<Departamento[]> {
  const deps = await api.departamentos.listar();
  console.log("\nDEPARTAMENTOS");
  if (deps.length === 0) console.log("  (sin registros)");
  else console.table(deps);
  return deps;
}

async function mostrarEmpleados(): Promise<void> {
  const [emps, deps] = await Promise.all([
    api.empleados.listar(),
    api.departamentos.listar(),
  ]);
  console.log("\nEMPLEADOS");
  if (emps.length === 0) {
    console.log("  (sin registros)");
    return;
  }
  console.table(
    emps.map((e) => ({
      id: e.id,
      nombre: e.nombre,
      departamento:
        deps.find((d) => String(d.id) === String(e.departamentoId))?.nombre ??
        "Desconocido",
    })),
  );
}


async function crearEmpleado() {
  await mostrarDepartamentos();
  const nombre = await pedirTexto("Nombre del empleado: ");
  const depId = await pedirId("ID del departamento: ");
  await api.departamentos.obtener(depId); // valida que exista
  const creado = await api.empleados.crear(nombre, depId);
  console.log(`✔ Empleado creado con id ${creado.id}.`);
}

async function crearDepartamento() {
  const nombre = await pedirTexto("Nombre del departamento: ");
  const deps = await api.departamentos.listar();
  if (deps.some((d) => d.nombre.toLowerCase() === nombre.toLowerCase())) {
    throw new Error(`Ya existe el departamento "${nombre}".`);
  }
  const creado = await api.departamentos.crear(nombre);
  console.log(`✔ Departamento creado con id ${creado.id}.`);
}

async function actualizarEmpleado() {
  await mostrarEmpleados();
  const id = await pedirId("ID del empleado a modificar: ");
  const actual = await api.empleados.obtener(id);

  const nombre = await preguntar(`Nuevo nombre [${actual.nombre}]: `);
  await mostrarDepartamentos();
  const depId = await preguntar(
    `Nuevo ID de departamento [${actual.departamentoId}]: `,
  );

  const cambios: Partial<Omit<Empleado, "id">> = {};
  if (nombre) cambios.nombre = nombre;
  if (depId) {
    await api.departamentos.obtener(depId);
    cambios.departamentoId = depId;
  }
  if (Object.keys(cambios).length === 0) {
    console.log("No se hicieron cambios.");
    return;
  }
  await api.empleados.actualizar(id, cambios);
  console.log("✔ Empleado actualizado.");
}

async function actualizarDepartamento() {
  await mostrarDepartamentos();
  const id = await pedirId("ID del departamento a modificar: ");
  const actual = await api.departamentos.obtener(id);
  const nombre = await preguntar(`Nuevo nombre [${actual.nombre}]: `);
  if (!nombre) {
    console.log("No se hicieron cambios.");
    return;
  }
  await api.departamentos.actualizar(id, nombre);
  console.log("✔ Departamento actualizado.");
}

async function eliminarEmpleado() {
  await mostrarEmpleados();
  const id = await pedirId("ID del empleado a eliminar: ");
  const emp = await api.empleados.obtener(id);
  if (await confirmar(`¿Eliminar a ${emp.nombre}?`)) {
    await api.empleados.eliminar(id);
    console.log("✔ Empleado eliminado.");
  } else {
    console.log("Operación cancelada.");
  }
}

async function eliminarDepartamento() {
  await mostrarDepartamentos();
  const id = await pedirId("ID del departamento a eliminar: ");
  const dep = await api.departamentos.obtener(id);

  const asignados = await api.empleados.listar(id);
  if (asignados.length > 0) {
    throw new Error(
      `No se puede eliminar "${dep.nombre}": tiene ${asignados.length} empleado(s) asignado(s).`,
    );
  }
  if (await confirmar(`¿Eliminar el departamento ${dep.nombre}?`)) {
    await api.departamentos.eliminar(id);
    console.log("✔ Departamento eliminado.");
  } else {
    console.log("Operación cancelada.");
  }
}


const MENU = `
==================== MENÚ ====================
  1. Listar empleados
  2. Listar departamentos
  3. Crear empleado
  4. Crear departamento
  5. Modificar empleado
  6. Modificar departamento
  7. Eliminar empleado
  8. Eliminar departamento
  0. Salir
==============================================`;

const acciones: Record<string, () => Promise<unknown>> = {
  "1": mostrarEmpleados,
  "2": mostrarDepartamentos,
  "3": crearEmpleado,
  "4": crearDepartamento,
  "5": actualizarEmpleado,
  "6": actualizarDepartamento,
  "7": eliminarEmpleado,
  "8": eliminarDepartamento,
};

async function main() {
  while (true) {
    console.log(MENU);
    const opcion = await preguntar("Elige una opción: ");

    if (opcion === "0") break;

    const accion = acciones[opcion];
    if (!accion) {
      console.log("Opción no válida.");
      continue;
    }

    try {
      await accion();
    } catch (e) {
      console.log(`✖ ${(e as Error).message}`);
    }
  }
  rl.close();
  console.log("¡Hasta pronto!");
}

main();
