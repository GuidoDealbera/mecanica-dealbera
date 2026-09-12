import { EntityManager, Not } from "typeorm";
import { Client } from "./Entities/client.entity";

/**
 * Reglas de unicidad de los clientes, en un solo lugar.
 *
 * `fullname` y `phone` son `unique` en la base. Si el endpoint no comprueba
 * antes, el `save` lanza el error crudo de SQLite —`UNIQUE constraint failed:
 * client.phone`— y eso es lo que termina viendo el usuario.
 *
 * La comprobación estaba escrita dos veces (en `car:create` y en
 * `car:reassign-owner`) y **faltaba** en `client:create` y `client:update`, que
 * son los dos caminos por los que se cargan clientes todo el día. Vive acá para
 * que no haya una cuarta copia con un criterio distinto.
 *
 * Recibe el `EntityManager` por parámetro, como el resto del dominio: así
 * funciona igual dentro de una transacción en curso.
 */

/**
 * Devuelve el motivo por el que estos datos chocan con otro cliente, o `null`
 * si están libres.
 *
 * `excluirId` es el cliente que se está editando: sin él, editar un cliente
 * sin cambiarle el nombre chocaría consigo mismo.
 */
export const findClientConflict = async (
  manager: EntityManager,
  datos: { fullname?: string | null; phone?: string | null },
  excluirId?: string
): Promise<string | null> => {
  const distintoDelEditado = excluirId ? { id: Not(excluirId) } : {};

  if (datos.fullname) {
    const porNombre = await manager.findOne(Client, {
      where: { fullname: datos.fullname, ...distintoDelEditado },
    });
    if (porNombre) {
      return `Ya existe un cliente llamado "${datos.fullname}"`;
    }
  }

  if (datos.phone) {
    const porTelefono = await manager.findOne(Client, {
      where: { phone: datos.phone, ...distintoDelEditado },
    });
    if (porTelefono) {
      // El nombre del otro cliente va en el mensaje a propósito: sin eso, el
      // usuario no tiene forma de saber con quién chocó ni si es la misma
      // persona cargada dos veces.
      return `El teléfono ya está registrado a nombre de ${porTelefono.fullname}`;
    }
  }

  return null;
};

/** Campos del titular que se comparan, con el nombre que ve el usuario. */
const CAMPOS_COMPARABLES = [
  ["phone", "el teléfono"],
  ["address", "la dirección"],
  ["city", "la localidad"],
  ["email", "el correo"],
] as const;

const normalizar = (valor: unknown): string =>
  typeof valor === "string" ? valor.trim() : "";

/**
 * Compara los datos del titular que se acaban de cargar contra los del cliente
 * que ya existe con ese nombre, y devuelve en qué difieren.
 *
 * Existe porque al registrar un vehículo, si había un cliente con el mismo
 * nombre, se lo reutilizaba y **se descartaban en silencio** el teléfono, la
 * dirección, la localidad y el correo recién escritos. El mensaje decía
 * "Vehículo registrado correctamente". Dos formas de que eso muerda: un cliente
 * nuevo que se llama igual que uno viejo queda con el teléfono del otro —y a
 * quien se llama por el recordatorio de service es a la persona equivocada—, o
 * es la misma persona que cambió de teléfono y el dato nuevo se pierde.
 *
 * Sólo se comparan los campos que vinieron con algo: dejar uno en blanco es no
 * haberlo retipeado, no pedir que se borre. El flujo normal —elegir el cliente
 * del autocompletar, que rellena sus datos— no dispara nada.
 */
export const describeOwnerMismatch = (
  existente: Client,
  entrantes: Partial<Client>
): string[] =>
  CAMPOS_COMPARABLES.filter(([campo]) => {
    const nuevo = normalizar(entrantes[campo]);
    return nuevo !== "" && nuevo !== normalizar(existente[campo]);
  }).map(([, etiqueta]) => etiqueta);
