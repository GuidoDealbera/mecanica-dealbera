import React from "react";
import { Chip, Spinner } from "@heroui/react";
import { MdDescription, MdReceiptLong } from "react-icons/md";
import {
  DocumentType,
  type DocumentQueryParams,
  type IssuedDocument,
} from "../Types/apiTypes";
import { formatARS } from "../Utils/utils";

interface DocumentHistoryProps {
  /** Filtros del listado. Sin patente, trae el historial de todo el taller. */
  filters?: DocumentQueryParams;
  /** Texto cuando no hay ninguno emitido todavía. */
  emptyText?: string;
  /** Mostrar la patente en cada fila (no hace falta dentro de una ficha). */
  showPlate?: boolean;
}

const TYPE_LABEL: Record<DocumentType, string> = {
  [DocumentType.BUDGET]: "Presupuesto",
  [DocumentType.INVOICE]: "Factura",
};

const TYPE_COLOR: Record<DocumentType, "primary" | "success"> = {
  [DocumentType.BUDGET]: "primary",
  [DocumentType.INVOICE]: "success",
};

/** Fecha corta con hora: dos documentos del mismo día son lo habitual. */
const formatIssued = (iso: string): string =>
  new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * Documentos ya emitidos.
 *
 * `document:list` estaba implementado desde que se agregó la numeración
 * correlativa y no lo consumía ninguna pantalla: no había forma de saber qué se
 * emitió, ni de recuperar un número para referirse a él por teléfono.
 *
 * Lo que se guarda es el **registro** del documento (número, patente, titular y
 * total), no sus ítems, así que esto es un historial y no permite reimprimir el
 * PDF original. Volver a emitirlo daría otro número, que es lo correcto.
 */
const DocumentHistory: React.FC<DocumentHistoryProps> = ({
  filters,
  emptyText = "Todavía no se emitió ningún documento.",
  showPlate = false,
}) => {
  const [documents, setDocuments] = React.useState<IssuedDocument[]>([]);
  const [loading, setLoading] = React.useState(true);

  // `filters` suele venir como objeto literal, que cambia de identidad en cada
  // render: se depende de sus valores y no de la referencia.
  const { type, licensePlate, limit } = filters ?? {};

  const load = React.useCallback(() => {
    setLoading(true);
    window.api.documents
      .list({ type, licensePlate, limit })
      .then(setDocuments)
      .catch(() => setDocuments([]))
      .finally(() => setLoading(false));
  }, [type, licensePlate, limit]);

  // Emitir un documento invalida la caché del dashboard, así que el aviso de
  // "cambiaron los datos" también cubre este listado.
  React.useEffect(() => {
    load();
    return window.api.onDataChanged(load);
  }, [load]);

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Spinner size="sm" color="primary" />
      </div>
    );
  }

  if (documents.length === 0) {
    return <p className="text-foreground-400 text-sm py-2">{emptyText}</p>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-content2 border border-divider px-3 py-2"
        >
          {doc.type === DocumentType.INVOICE ? (
            <MdReceiptLong size={16} className="text-success flex-shrink-0" />
          ) : (
            <MdDescription size={16} className="text-primary flex-shrink-0" />
          )}

          <span className="font-semibold text-sm tabular-nums">
            {doc.formatted}
          </span>

          <Chip size="sm" variant="flat" color={TYPE_COLOR[doc.type]}>
            {TYPE_LABEL[doc.type]}
          </Chip>

          {showPlate && (
            <span className="text-xs text-foreground-500">
              {doc.licensePlate}
            </span>
          )}

          <span className="text-xs text-foreground-400 truncate max-w-[180px]">
            {doc.clientName}
          </span>

          <span className="text-xs text-foreground-400 ml-auto">
            {formatIssued(doc.createdAt)}
          </span>

          <span className="text-sm font-semibold tabular-nums">
            {formatARS(doc.total)}
          </span>
        </div>
      ))}
    </div>
  );
};

export default DocumentHistory;
