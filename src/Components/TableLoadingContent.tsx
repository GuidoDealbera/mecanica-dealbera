import React from "react";
import { Spinner } from "@heroui/react";

interface TableLoadingContentProps {
  label?: string;
}

/**
 * Contenido de carga para las tablas: spinner + texto. Se pasa como
 * `loadingContent` del `TableBody` de HeroUI y se muestra cuando `isLoading`
 * es `true` (HeroUI no renderiza ningún indicador si no se le provee este
 * contenido). Da feedback tanto en la primera carga como en cada refresco.
 *
 * El overlay queda transparente (sólo desenfoca la tabla) y la placa interna usa
 * `content1`, el token de superficie elevada: blanco en claro y casi negro en
 * oscuro, sin necesidad de variantes `dark:`.
 */
const TableLoadingContent: React.FC<TableLoadingContentProps> = ({
  label = "Cargando...",
}) => (
  <div className="flex justify-center items-center w-full h-full backdrop-blur-xs z-10">
    <div className="flex flex-col items-center justify-center gap-3 w-60 h-32 bg-content1 border border-divider rounded-large shadow-medium">
      <Spinner size="lg" color="primary" />
      <span className="text-foreground text-md font-semibold">{label}</span>
    </div>
  </div>
);

export default TableLoadingContent;
