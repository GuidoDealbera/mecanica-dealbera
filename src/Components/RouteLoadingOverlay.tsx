import React from "react";
import TableLoadingContent from "./TableLoadingContent";

interface RouteLoadingOverlayProps {
  label?: string;
}

/**
 * Fallback de las rutas diferidas (`React.lazy`): cubre toda el área de
 * contenido mientras se descarga el chunk de la pantalla.
 *
 * Reutiliza `TableLoadingContent` para que el indicador sea exactamente el
 * mismo que el de las tablas — una sola forma de "cargando" en toda la app.
 */
const RouteLoadingOverlay: React.FC<RouteLoadingOverlayProps> = ({
  label = "Cargando...",
}) => (
  <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/60">
    <TableLoadingContent label={label} />
  </div>
);

export default RouteLoadingOverlay;
