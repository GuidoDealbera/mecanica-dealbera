/**
 * Acota la página pedida a la última que existe según el total conocido.
 *
 * Reemplaza a la corrección "si la página quedó vacía, retroceder una" que
 * antes vivía en un efecto. Ese arreglo funcionaba pero costaba un ida y vuelta
 * por página sobrante: pasar de la 6 a un filtro que deja 3 resultados hacía
 * cinco consultas encadenadas —6 vacía, 5 vacía, 4 vacía…— y cada una repintaba
 * la tabla vacía. Acotando al leer, la página inválida nunca se llega a pedir
 * dos veces: la respuesta que trae el total nuevo ya alcanza para ir a la
 * última buena.
 *
 * `total` es el del último listado recibido. Mientras una consulta está en
 * vuelo se conserva el anterior a propósito: acotar contra un total en cero
 * mandaría a la página 1 en cada recarga.
 */
export const clampPage = (
  page: number,
  total: number,
  pageSize: number
): number => {
  if (pageSize <= 0) return 1;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  return Math.min(Math.max(1, Math.trunc(page)), lastPage);
};
