import React from "react";
import { Button, Chip, Input, Spinner, Tooltip } from "@heroui/react";
import { MdDescription, MdPrint, MdReceiptLong } from "react-icons/md";
import { IoSearch } from "react-icons/io5";
import {
  DocumentType,
  type DocumentQueryParams,
  type IssuedDocument,
} from "../Types/apiTypes";
import { formatARS } from "../Utils/utils";
import { useBudgetPDF } from "../Hooks/useBudgetPdf";
import { useToasts } from "../Hooks/useToasts";
import { useDebounce } from "../Hooks/useDebounce";
import { clampPage } from "../Utils/pagination";
import TablePagination from "./TablePagination";

interface DocumentHistoryProps {
  /** Filtros del listado. Sin patente, trae el historial de todo el taller. */
  filters?: DocumentQueryParams;
  /**
   * Muestra la búsqueda, el rango de fechas y el paginado.
   *
   * Apagado dentro de una ficha, donde el listado es un bloque más y son pocos
   * documentos; encendido en la pantalla de datos, que es la que se usa para
   * encontrar un documento entre dos años de historial.
   */
  searchable?: boolean;
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
  searchable = false,
  filters,
  emptyText = "Todavía no se emitió ningún documento.",
  showPlate = false,
}) => {
  const [documents, setDocuments] = React.useState<IssuedDocument[]>([]);
  const { reimprimir, isGenerating } = useBudgetPDF();
  const { showToast } = useToasts();

  const handleReimprimir = React.useCallback(
    async (doc: IssuedDocument) => {
      try {
        const hecho = await reimprimir(doc.id);
        // `null` es que el usuario canceló el guardado: no hay nada que avisar.
        if (hecho) {
          showToast(
            `Documento ${doc.formatted} generado de nuevo`,
            "success",
            "Reimprimir"
          );
        }
      } catch (err) {
        showToast(
          err instanceof Error ? err.message : "No se pudo reimprimir",
          "danger",
          "Reimprimir"
        );
      }
    },
    [reimprimir, showToast]
  );
  const [loading, setLoading] = React.useState(true);

  // `filters` suele venir como objeto literal, que cambia de identidad en cada
  // render: se depende de sus valores y no de la referencia.
  const { type, licensePlate, pageSize } = filters ?? {};

  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [total, setTotal] = React.useState(0);

  const porPagina = pageSize ?? 15;
  // La página pedida, acotada a la última que existe. Se deriva al leer en vez
  // de corregirse con un efecto: ver `clampPage`.
  const effectivePage = clampPage(page, total, porPagina);

  const load = React.useCallback(() => {
    setLoading(true);
    window.api.documents
      .list({
        type,
        licensePlate,
        page: effectivePage,
        pageSize: porPagina,
        search: debouncedSearch || undefined,
        from: from || undefined,
        to: to || undefined,
      })
      .then((res) => {
        setDocuments(res.result?.items ?? []);
        setTotal(res.result?.total ?? 0);
      })
      .catch(() => {
        setDocuments([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [type, licensePlate, effectivePage, porPagina, debouncedSearch, from, to]);

  // Emitir un documento invalida la caché del dashboard, así que el aviso de
  // "cambiaron los datos" también cubre este listado.
  // El aviso salta por el `setLoading(true)` con el que arranca `load`, que es
  // sincrónico. Suscribirse a un sistema externo y traer sus datos es
  // justamente para lo que están los efectos; sin ese `true` inmediato la
  // pantalla mostraría el listado viejo mientras llega el nuevo.
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga y suscripción a un sistema externo
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

  const filtros = searchable ? (
    <div className="flex flex-wrap items-end gap-2 mb-2">
      <Input
        size="sm"
        className="max-w-[260px]"
        placeholder="Buscar por titular o patente"
        startContent={<IoSearch size={16} />}
        value={search}
        onValueChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        isClearable
        onClear={() => {
          setSearch("");
          setPage(1);
        }}
      />
      <Input
        size="sm"
        type="date"
        label="Desde"
        className="max-w-[160px]"
        value={from}
        onValueChange={(v) => {
          setFrom(v);
          setPage(1);
        }}
      />
      <Input
        size="sm"
        type="date"
        label="Hasta"
        className="max-w-[160px]"
        value={to}
        onValueChange={(v) => {
          setTo(v);
          setPage(1);
        }}
      />
    </div>
  ) : null;

  const paginado =
    searchable && total > porPagina ? (
      <TablePagination
        page={effectivePage}
        pageSize={porPagina}
        total={total}
        onPageChange={setPage}
      />
    ) : null;

  if (documents.length === 0) {
    return (
      <>
        {filtros}
        <p className="text-foreground-400 text-sm py-2">
          {/* Con filtros puestos, "no hay ninguno emitido" sería mentira. */}
          {searchable && (search || from || to)
            ? "Ningún documento coincide con la búsqueda."
            : emptyText}
        </p>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {filtros}
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

          {/* Reimprimir: el caso real es que el cliente pierda el papel. No
              emite nada —no toma número nuevo ni toca la base—, vuelve a
              dibujar la copia que se guardó al emitirlo. */}
          <Tooltip
            content={
              doc.hasSnapshot
                ? "Volver a generar el PDF"
                : "Se emitió antes de que se guardara su contenido"
            }
            color={doc.hasSnapshot ? "primary" : "warning"}
            showArrow
          >
            {/* El `span` es para que el tooltip siga apareciendo con el botón
                deshabilitado, que es justo cuando hay algo que explicar. */}
            <span>
              <Button
                isIconOnly
                size="sm"
                variant="light"
                aria-label={`Reimprimir ${doc.formatted}`}
                isDisabled={!doc.hasSnapshot || isGenerating}
                onPress={() => handleReimprimir(doc)}
              >
                <MdPrint size={16} />
              </Button>
            </span>
          </Tooltip>
        </div>
      ))}
      {paginado}
    </div>
  );
};

export default DocumentHistory;
