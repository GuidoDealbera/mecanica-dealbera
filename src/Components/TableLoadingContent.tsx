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
 */
const TableLoadingContent: React.FC<TableLoadingContentProps> = ({
  label = "Cargando...",
}) => (
  <div className="flex flex-col items-center justify-center gap-3">
    <Spinner size="lg" color="primary" />
    <span className="text-foreground-300 text-sm font-medium">{label}</span>
  </div>
);

export default TableLoadingContent;
