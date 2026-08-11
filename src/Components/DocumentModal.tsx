import React from "react";
import {
  Button,
  Checkbox,
  CheckboxGroup,
  Chip,
  Divider,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Tab,
  Tabs,
} from "@heroui/react";
import { MdPictureAsPdf, MdInfoOutline } from "react-icons/md";
import { Cars, Jobs } from "../Types/types";
import {
  DocumentType,
  JobStatus,
  STATUS_LABELS,
  type IssuedDocument,
} from "../Types/apiTypes";
import { computeTotals, eligibleJobsForDocument } from "../Utils/budgetPdf";
import { formatARS } from "../Utils/utils";
import EmptyState from "./EmptyState";

/** Color del chip de estado, igual que en la tabla de trabajos. */
const STATUS_COLOR: Record<
  JobStatus,
  "default" | "primary" | "success" | "secondary"
> = {
  [JobStatus.PENDING]: "default",
  [JobStatus.IN_PROGRESS]: "primary",
  [JobStatus.COMPLETED]: "success",
  [JobStatus.DELIVERED]: "secondary",
};

const TYPE_OPTIONS: {
  key: DocumentType;
  label: string;
  hint: string;
}[] = [
  {
    key: DocumentType.BUDGET,
    label: "Presupuesto",
    hint: "Trabajos sin comenzar, en progreso y completados.",
  },
  {
    key: DocumentType.INVOICE,
    label: "Factura",
    hint: "Sólo trabajos completados: es lo que ya se hizo y se puede cobrar.",
  },
];

interface DocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  car: Cars;
  /** Todos los trabajos del vehículo; el modal filtra los que puede incluir. */
  jobs: Jobs[];
  isGenerating: boolean;
  onConfirm: (
    type: DocumentType,
    selected: Jobs[]
  ) => Promise<IssuedDocument | void>;
}

/**
 * Modal de emisión de documentos: se elige el tipo (presupuesto o factura) y
 * **qué trabajos** entran.
 *
 * Antes el documento se armaba con todos los trabajos del vehículo (o con
 * "completados y entregados" para la factura), así que reimprimía trabajos ya
 * entregados —es decir, ya cobrados—. Los entregados quedan fuera de la lista a
 * propósito: viven en el historial del vehículo, no en documentos nuevos.
 */
const DocumentModal: React.FC<DocumentModalProps> = ({
  isOpen,
  onClose,
  car,
  jobs,
  isGenerating,
  onConfirm,
}) => {
  const [type, setType] = React.useState<DocumentType>(DocumentType.BUDGET);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  const eligible = React.useMemo(
    () => eligibleJobsForDocument(jobs, type),
    [jobs, type]
  );
  const deliveredCount = React.useMemo(
    () => jobs.filter((j) => j.status === JobStatus.DELIVERED).length,
    [jobs]
  );

  // Al abrir o cambiar el tipo se preselecciona todo lo elegible: el caso
  // habitual es emitir el documento completo y desmarcar alguna excepción.
  React.useEffect(() => {
    if (isOpen) setSelectedIds(eligible.map((j) => j.id));
  }, [isOpen, eligible]);

  const selectedJobs = React.useMemo(
    () => eligible.filter((j) => selectedIds.includes(j.id)),
    [eligible, selectedIds]
  );
  const totals = React.useMemo(
    () => computeTotals(selectedJobs),
    [selectedJobs]
  );

  const allSelected =
    eligible.length > 0 && selectedIds.length === eligible.length;

  const handleConfirm = async () => {
    await onConfirm(type, selectedJobs);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      placement="center"
      backdrop="blur"
      scrollBehavior="inside"
    >
      <ModalContent className="bg-content1">
        <ModalHeader className="flex flex-col gap-1">
          <span className="flex items-center gap-2 text-lg font-bold">
            <MdPictureAsPdf size={20} className="text-primary" />
            Emitir documento
          </span>
          <span className="text-foreground-400 text-xs font-normal">
            {car.licensePlate} — {car.brand} {car.model} ·{" "}
            {car.owner?.fullname ?? "Sin titular"}
          </span>
        </ModalHeader>
        <Divider className="bg-divider" />

        <ModalBody className="gap-4">
          <div>
            <Tabs
              aria-label="Tipo de documento"
              color="primary"
              selectedKey={type}
              onSelectionChange={(key) => setType(key as DocumentType)}
            >
              {TYPE_OPTIONS.map((option) => (
                <Tab key={option.key} title={option.label} />
              ))}
            </Tabs>
            <p className="text-foreground-400 text-xs mt-2">
              {TYPE_OPTIONS.find((o) => o.key === type)?.hint}
            </p>
          </div>

          {deliveredCount > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-primary/10 p-3">
              <MdInfoOutline
                size={16}
                className="text-primary flex-shrink-0 mt-0.5"
              />
              <p className="text-foreground-500 text-xs">
                {deliveredCount === 1
                  ? "1 trabajo entregado queda fuera"
                  : `${deliveredCount} trabajos entregados quedan fuera`}
                : ya fueron cobrados y entregados, así que sólo figuran en el
                historial del vehículo.
              </p>
            </div>
          )}

          {eligible.length === 0 ? (
            <EmptyState
              icon={<MdPictureAsPdf size={26} />}
              title="Sin trabajos para incluir"
              description={
                type === DocumentType.INVOICE
                  ? "Este vehículo no tiene trabajos completados. Marcá un trabajo como completado para poder facturarlo."
                  : "Este vehículo no tiene trabajos pendientes de cobro."
              }
            />
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-foreground-500 text-xs">
                  {selectedIds.length} de {eligible.length} trabajos
                  seleccionados
                </p>
                <Button
                  size="sm"
                  variant="light"
                  color="primary"
                  onPress={() =>
                    setSelectedIds(allSelected ? [] : eligible.map((j) => j.id))
                  }
                >
                  {allSelected ? "Ninguno" : "Seleccionar todos"}
                </Button>
              </div>

              <CheckboxGroup
                aria-label="Trabajos a incluir"
                value={selectedIds}
                onValueChange={setSelectedIds}
                classNames={{ wrapper: "gap-2" }}
              >
                {eligible.map((job) => {
                  const partsTotal = (job.parts ?? []).reduce(
                    (acc, p) => acc + p.price,
                    0
                  );
                  return (
                    <Checkbox
                      key={job.id}
                      value={job.id}
                      classNames={{
                        base: "max-w-full w-full m-0 items-start rounded-lg border border-divider bg-content2 p-3 data-[selected=true]:border-primary",
                        label: "w-full",
                      }}
                    >
                      <div className="flex items-start justify-between gap-3 w-full">
                        <div className="min-w-0">
                          <p className="text-sm font-medium break-words">
                            {job.description}
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Chip
                              size="sm"
                              variant="flat"
                              color={STATUS_COLOR[job.status]}
                            >
                              {STATUS_LABELS[job.status]}
                            </Chip>
                            {job.isThirdParty && (
                              <Chip size="sm" variant="flat">
                                Terceros
                              </Chip>
                            )}
                            {partsTotal > 0 && (
                              <span className="text-foreground-400 text-xs">
                                Repuestos {formatARS(partsTotal)}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-sm font-semibold whitespace-nowrap">
                          {formatARS((job.price ?? 0) + partsTotal)}
                        </span>
                      </div>
                    </Checkbox>
                  );
                })}
              </CheckboxGroup>
            </div>
          )}
        </ModalBody>

        <Divider className="bg-divider" />
        <ModalFooter className="flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-foreground-400 text-xs">Total del documento</p>
            <p className="text-xl font-bold text-primary">
              {formatARS(totals.total)}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="light" onPress={onClose} isDisabled={isGenerating}>
              Cancelar
            </Button>
            <Button
              color="primary"
              isLoading={isGenerating}
              isDisabled={selectedJobs.length === 0 || isGenerating}
              startContent={
                !isGenerating ? <MdPictureAsPdf size={16} /> : undefined
              }
              onPress={handleConfirm}
            >
              {isGenerating
                ? "Generando..."
                : `Emitir ${type === DocumentType.INVOICE ? "factura" : "presupuesto"}`}
            </Button>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default DocumentModal;
