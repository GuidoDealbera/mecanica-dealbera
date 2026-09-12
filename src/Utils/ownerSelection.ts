/**
 * Quién es el titular del vehículo que se está dando de alta.
 *
 * La pregunta que resuelve este módulo es una sola: **¿el usuario eligió a un
 * cliente que ya existe, o escribió uno nuevo?** De eso depende que el alta le
 * asocie el auto a una ficha existente o cree otra.
 *
 * Antes lo decidía el backend buscando por nombre, y ese era el problema de
 * fondo: el nombre pasaba a ser la identidad del cliente. Dos personas que se
 * llaman igual eran la misma, y escribir el nombre de alguien alcanzaba para
 * quedarse con su ficha sin haberlo elegido.
 *
 * Ahora lo decide el formulario, que es el único que lo sabe. Vive acá y no
 * dentro del componente porque es una regla, no maquetación: se puede probar
 * sin montar el formulario ni el widget de HeroUI.
 */

/** Lo mínimo que hace falta saber de un cliente para elegirlo como titular. */
export interface TitularElegible {
  id: string;
  fullname: string;
}

/**
 * El cliente que corresponde a la opción elegida en el autocompletar.
 *
 * Las opciones se identifican por `id`. Con el nombre como clave, dos clientes
 * homónimos colisionaban entre sí en la lista.
 */
export const buscarTitularPorId = <T extends TitularElegible>(
  resultados: readonly T[],
  id: unknown
): T | undefined => resultados.find((cliente) => cliente.id === id);

/**
 * Qué queda seleccionado después de que el usuario edita el campo del nombre.
 *
 * Editar el nombre deja de ser "elegir": el titular vuelve a ser nuevo. Pero
 * mientras el texto siga siendo exactamente el del cliente elegido se conserva
 * la selección —y **el mismo objeto**, no una copia—, porque el formulario
 * rellena los datos del titular en un efecto que depende de esa referencia: si
 * cambiara en cada tecla, el efecto reescribiría los campos todo el tiempo.
 */
export const seleccionTrasEditarNombre = <T extends TitularElegible>(
  seleccionActual: T | undefined,
  textoEscrito: string
): T | undefined =>
  seleccionActual && seleccionActual.fullname === textoEscrito
    ? seleccionActual
    : undefined;
