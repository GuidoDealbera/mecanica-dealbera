import React from "react";

/**
 * Prepara estado cuando cambia aquello de lo que depende, **durante el render**
 * y no desde un efecto.
 *
 * `token` identifica lo que hay que preparar y `null` significa "nada que
 * preparar" —un modal cerrado, por ejemplo—. Cada vez que `token` cambia a un
 * valor distinto y no nulo, se corre `reset`.
 *
 * Reemplaza al patrón `useEffect(() => { if (abierto) setX(...) }, [abierto,
 * dato])`. Aquel funciona, pero pinta una vez con el estado de la vez anterior
 * y recién después lo corrige: un render de más y, en un modal, un parpadeo con
 * los datos del registro que se editó antes.
 *
 * Actualizar el estado durante el render es lo que documenta React para esto:
 * descarta el render en curso y vuelve a empezar con el estado nuevo **sin
 * llegar a pintar**. Sólo vale para el estado del propio componente: si hay que
 * avisarle a algo de afuera —el `reset` de react-hook-form, el DOM, una
 * suscripción— eso sigue yendo en un efecto.
 */
export const useResetOn = (token: unknown, reset: () => void): void => {
  // Arranca en `null` y no en el token actual a propósito: un componente que se
  // monta con el modal ya abierto también tiene que preparar sus campos. El
  // efecto que esto reemplaza corría al montar, y sin este detalle los campos
  // quedaban vacíos en ese caso.
  const [previo, setPrevio] = React.useState<unknown>(null);
  if (!Object.is(previo, token)) {
    setPrevio(token);
    if (token !== null) reset();
  }
};
