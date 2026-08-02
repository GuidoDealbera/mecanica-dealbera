import React from "react";
import { Pagination } from "@heroui/react";

interface TablePaginationProps {
  /** Página actual (1-based). */
  page: number;
  pageSize: number;
  /** Total de **registros** (no de páginas). */
  total: number;
  onPageChange: (page: number) => void;
}

/**
 * Footer de paginación compartido por las tablas. Unifica el contador de
 * registros y el `Pagination` de HeroUI para que las tres tablas (autos,
 * clientes y trabajos) se vean y se comporten igual: sin registros no se
 * muestra nada, y con una sola página se muestra el contador pero no los
 * controles, que no tendrían a dónde llevar.
 */
const TablePagination: React.FC<TablePaginationProps> = ({
  page,
  pageSize,
  total,
  onPageChange,
}) => {
  if (total === 0) return null;

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex justify-end items-center p-3 gap-4">
      <span>
        Mostrando {from} – {to} de {total}{" "}
        {total === 1 ? "registro" : "registros"}
      </span>
      {pages > 1 && (
        <Pagination
          showControls
          showShadow
          page={page}
          total={pages}
          onChange={onPageChange}
        />
      )}
    </div>
  );
};

export default TablePagination;
