import { useEffect, useRef } from "react";

/**
 * Vuelve a pedir los datos cuando **pasó el tiempo**, no sólo cuando alguien
 * escribió algo.
 *
 * Los dos mecanismos que tenía la aplicación —la invalidación de la caché y el
 * aviso `data-changed`— se disparan ante escrituras. Pero hay números que
 * dependen de la fecha y no de los datos: el mes en curso del dashboard, y los
 * recordatorios de service que vencen a una fecha. Un taller que deja la
 * aplicación abierta —lo normal— cruzaba la medianoche y seguía viendo lo de
 * ayer hasta que alguien cargara algo.
 *
 * Dos disparadores, por dos motivos distintos:
 *
 * - **Volver el foco a la ventana**: es cuando la persona vuelve a mirar, así
 *   que es el momento en que un número viejo se nota.
 * - **Cambiar el día calendario**: para la ventana que queda abierta y a la
 *   vista toda la noche. Se chequea cada minuto, pero sólo se refresca cuando
 *   la fecha efectivamente cambió; comparar dos textos por minuto no le cuesta
 *   nada a nadie, y sondear la base cada minuto sí.
 */

/** El día calendario de una fecha, como texto comparable. */
const dia = (fecha: Date): string =>
  `${fecha.getFullYear()}-${fecha.getMonth()}-${fecha.getDate()}`;

const UN_MINUTO = 60_000;

export const useRefrescoPorTiempo = (
  refrescar: () => void,
  intervaloMs: number = UN_MINUTO
): void => {
  // Por referencia: así cambiar la función no reinicia el intervalo ni vuelve a
  // suscribir el `focus` en cada render. La asignación va en un efecto y no en
  // el cuerpo porque escribir una ref durante el render es justo lo que
  // `react-hooks` marca como error, y con razón: el render puede descartarse.
  const ultimo = useRef(refrescar);
  useEffect(() => {
    ultimo.current = refrescar;
  }, [refrescar]);

  useEffect(() => {
    let diaVisto = dia(new Date());

    const alVolverElFoco = () => ultimo.current();

    const cadaTanto = window.setInterval(() => {
      const hoy = dia(new Date());
      if (hoy === diaVisto) return;
      diaVisto = hoy;
      ultimo.current();
    }, intervaloMs);

    window.addEventListener("focus", alVolverElFoco);
    return () => {
      window.clearInterval(cadaTanto);
      window.removeEventListener("focus", alVolverElFoco);
    };
  }, [intervaloMs]);
};
