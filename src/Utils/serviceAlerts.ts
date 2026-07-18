export type ServiceUrgency = "danger" | "warning" | "default";

/**
 * Nivel de urgencia de una alerta de service según los días transcurridos
 * desde el último trabajo.
 * - `null` (auto sin trabajos registrados) => "warning".
 * - más de 365 días => "danger".
 * - más de 180 días => "warning".
 * - resto => "default".
 */
export const getServiceUrgency = (days: number | null): ServiceUrgency => {
  if (days === null) return "warning";
  if (days > 365) return "danger";
  if (days > 180) return "warning";
  return "default";
};

/**
 * Etiqueta legible para la antigüedad del último trabajo.
 * - `null` => "Sin trabajos".
 * - más de 365 días => se expresa en meses.
 * - resto => se expresa en días.
 */
export const formatServiceUrgencyLabel = (days: number | null): string => {
  if (days === null) return "Sin trabajos";
  if (days > 365) return `${Math.floor(days / 30)} meses`;
  return `${days} días`;
};
