
interface Departamento {
  id: number;
  nombre: string;
}

interface Empleado {
  id: number;
  nombre: string;
  departamentoId: number;
}

interface Datos {
  departamentos: Departamento[];
  empleados: Empleado[];
}

type NuevoDepartamento = Omit<Departamento, "id">;
type NuevoEmpleado = Omit<Empleado, "id">;


const datos: Datos = {
  departamentos: [
    { id: 1, nombre: "Informática" },
    { id: 2, nombre: "RRHH" },
  ],
  empleados: [
    { id: 1, nombre: "Daniel", departamentoId: 1 },
    { id: 2, nombre: "Ana", departamentoId: 1 },
    { id: 3, nombre: "Pedro", departamentoId: 2 },
  ],
};

function siguienteId(items: { id: number }[]): number {
  return items.length === 0 ? 1 : Math.max(...items.map((i) => i.id)) + 1;
}


class DepartamentoService {
  constructor(private db: Datos) {}

  crear(nuevo: NuevoDepartamento): Departamento {
    const nombre = nuevo.nombre.trim();
    if (!nombre) throw new Error("El nombre del departamento es obligatorio.");

    const existe = this.db.departamentos.some(
      (d) => d.nombre.toLowerCase() === nombre.toLowerCase()
    );
    if (existe) throw new Error(`Ya existe el departamento "${nombre}".`);

    const departamento: Departamento = {
      id: siguienteId(this.db.departamentos),
      nombre,
    };
    this.db.departamentos.push(departamento);
    return departamento;
  }


  listar(): Departamento[] {
    return [...this.db.departamentos];
  }


  obtenerPorId(id: number): Departamento | undefined {
    return this.db.departamentos.find((d) => d.id === id);
  }


  actualizar(id: number, cambios: Partial<NuevoDepartamento>): Departamento {
    const departamento = this.obtenerPorId(id);
    if (!departamento) throw new Error(`Departamento ${id} no encontrado.`);

    if (cambios.nombre !== undefined) {
      const nombre = cambios.nombre.trim();
      if (!nombre) throw new Error("El nombre no puede estar vacío.");
      departamento.nombre = nombre;
    }
    return departamento;
  }

  eliminar(id: number): void {
    const indice = this.db.departamentos.findIndex((d) => d.id === id);
    if (indice === -1) throw new Error(`Departamento ${id} no encontrado.`);

    const tieneEmpleados = this.db.empleados.some((e) => e.departamentoId === id);
    if (tieneEmpleados) {
      throw new Error(
        `No se puede eliminar el departamento ${id}: tiene empleados asignados.`
      );
    }
    this.db.departamentos.splice(indice, 1);
  }
}


class EmpleadoService {
  constructor(private db: Datos) {}

  private validarDepartamento(departamentoId: number): void {
    const existe = this.db.departamentos.some((d) => d.id === departamentoId);
    if (!existe) throw new Error(`El departamento ${departamentoId} no existe.`);
  }


  crear(nuevo: NuevoEmpleado): Empleado {
    const nombre = nuevo.nombre.trim();
    if (!nombre) throw new Error("El nombre del empleado es obligatorio.");
    this.validarDepartamento(nuevo.departamentoId);

    const empleado: Empleado = {
      id: siguienteId(this.db.empleados),
      nombre,
      departamentoId: nuevo.departamentoId,
    };
    this.db.empleados.push(empleado);
    return empleado;
  }

  
  listar(departamentoId?: number): Empleado[] {
    return this.db.empleados.filter(
      (e) => departamentoId === undefined || e.departamentoId === departamentoId
    );
  }


  obtenerPorId(id: number): Empleado | undefined {
    return this.db.empleados.find((e) => e.id === id);
  }


  listarConDepartamento(): (Empleado & { departamento: string })[] {
    return this.db.empleados.map((e) => ({
      ...e,
      departamento:
        this.db.departamentos.find((d) => d.id === e.departamentoId)?.nombre ??
        "Desconocido",
    }));
  }


  actualizar(id: number, cambios: Partial<NuevoEmpleado>): Empleado {
    const empleado = this.obtenerPorId(id);
    if (!empleado) throw new Error(`Empleado ${id} no encontrado.`);

    if (cambios.nombre !== undefined) {
      const nombre = cambios.nombre.trim();
      if (!nombre) throw new Error("El nombre no puede estar vacío.");
      empleado.nombre = nombre;
    }
    if (cambios.departamentoId !== undefined) {
      this.validarDepartamento(cambios.departamentoId);
      empleado.departamentoId = cambios.departamentoId;
    }
    return empleado;
  }

  eliminar(id: number): void {
    const indice = this.db.empleados.findIndex((e) => e.id === id);
    if (indice === -1) throw new Error(`Empleado ${id} no encontrado.`);
    this.db.empleados.splice(indice, 1);
  }
}


const departamentos = new DepartamentoService(datos);
const empleados = new EmpleadoService(datos);

console.log("== Empleados con departamento ==");
console.table(empleados.listarConDepartamento());

console.log("\n== Crear departamento y empleado ==");
const ventas = departamentos.crear({ nombre: "Ventas" });
const lucia = empleados.crear({ nombre: "Lucía", departamentoId: ventas.id });
console.log(ventas, lucia);

console.log("\n== Actualizar empleado (Lucía pasa a RRHH) ==");
console.log(empleados.actualizar(lucia.id, { departamentoId: 2 }));

console.log("\n== Empleados de Informática ==");
console.log(empleados.listar(1));

console.log("\n== Eliminar empleado ==");
empleados.eliminar(lucia.id);
console.log(empleados.listar().map((e) => e.nombre));

console.log("\n== Eliminar departamento sin empleados ==");
departamentos.eliminar(ventas.id);
console.log(departamentos.listar());

console.log("\n== Errores controlados ==");
try {
  departamentos.eliminar(1); // Informática tiene empleados
} catch (e) {
  console.log("Error:", (e as Error).message);
}
try {
  empleados.crear({ nombre: "Marta", departamentoId: 99 });
} catch (e) {
  console.log("Error:", (e as Error).message);
}

