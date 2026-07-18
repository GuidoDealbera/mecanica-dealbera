import { useEffect, useState } from "react";

/**
 * Devuelve una versión "retrasada" del valor: solo se actualiza cuando pasaron
 * `delay` ms sin que `value` vuelva a cambiar. Útil para no disparar búsquedas
 * o filtros en cada tecla.
 */
export function useDebounce<T>(value: T, delay = 250): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
