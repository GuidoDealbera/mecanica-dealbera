import React from "react";
import { Jobs as CarJobs } from "../../Types/types";
import JobsTable from "../../Components/Tables/JobsTable";
import {
  Button,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
} from "@heroui/react";
import { IoIosAddCircleOutline } from "react-icons/io";
import { useNavigate } from "react-router-dom";
import { JobStatus, STATUS_LABELS, UpdateJobBody } from "../../Types/apiTypes";
import { useCarQueries } from "../../Hooks/useCarQueries";
import { useToasts } from "../../Hooks/useToasts";
import { MdAdd, MdDelete, MdEdit } from "react-icons/md";
import { formatARS, formatThousands, parseNumber } from "../../Utils/utils";

interface JobsProps {
  jobs: CarJobs[];
  isLoading: boolean;
  license?: string;
}

const Jobs: React.FC<JobsProps> = ({ jobs, isLoading, license }) => {
  const navigate = useNavigate();
  const { updateJob, loading: updating } = useCarQueries();
  const { showToast } = useToasts();

  const [editingJob, setEditingJob] = React.useState<CarJobs | null>(null);
  const [editStatus, setEditStatus] = React.useState<JobStatus>(
    JobStatus.PENDING,
  );
  const [editPrice, setEditPrice] = React.useState<number>(0);
  const [editParts, setEditParts] = React.useState<
    { name: string; price: number }[]
  >([]);

  const [partName, setPartName] = React.useState("");
  const [partPrice, setPartPrice] = React.useState<number | undefined>(
    undefined,
  );
  const [partNameError, setPartNameError] = React.useState("");
  const [partPriceError, setPartPriceError] = React.useState("");

  const handleOpenEdit = React.useCallback((job: CarJobs) => {
    setEditingJob(job);
    setEditStatus(job.status);
    setEditPrice(job.price);
    setEditParts(job.parts ?? []);
    setPartName("");
    setPartPrice(undefined);
    setPartNameError("");
    setPartPriceError("");
  }, []);

  const handleCloseEdit = React.useCallback(() => {
    setEditingJob(null);
  }, []);

  const handleAddPart = () => {
    let hasError = false;

    if (!partName.trim()) {
      setPartNameError("Ingresá un nombre");
      hasError = true;
    } else {
      setPartNameError("");
    }

    if (!partPrice || partPrice <= 0) {
      setPartPriceError("Ingresá un precio");
      hasError = true;
    } else {
      setPartPriceError("");
    }

    if (hasError) return;

    setEditParts((prev) => [
      ...prev,
      { name: partName.trim(), price: partPrice! },
    ]);
    setPartName("");
    setPartPrice(undefined);
  };

  const handleRemovePart = (index: number) => {
    setEditParts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveEdit = async () => {
    if (!editingJob || !license) return;

    const partsChanged =
      JSON.stringify(editParts) !== JSON.stringify(editingJob.parts ?? []);

    const hasChanges =
      editStatus !== editingJob.status ||
      editPrice !== editingJob.price ||
      partsChanged;

    if (!hasChanges) {
      showToast("No hay cambios para guardar", "warning", "Editar trabajo");
      handleCloseEdit();
      return;
    }

    const body: UpdateJobBody = {};
    if (editStatus !== editingJob.status) body.status = editStatus;
    if (editPrice !== editingJob.price) body.price = editPrice;
    if (partsChanged) body.parts = editParts;

    await updateJob(license, editingJob.id, body);
    handleCloseEdit();
  };

  const isPriceValid = editPrice > 0;
  const partsChanged = editingJob
    ? JSON.stringify(editParts) !== JSON.stringify(editingJob.parts ?? [])
    : false;
  const canSave =
    editingJob !== null &&
    isPriceValid &&
    (editStatus !== editingJob.status ||
      editPrice !== editingJob.price ||
      partsChanged);

  const totalParts = editParts.reduce((acc, p) => acc + p.price, 0);

  return (
    <div className="w-full min-h-full shadow shadow-primary bg-foreground-800 rounded-md p-3">
      <div className="flex justify-end items-center mb-4">
        <Button
          color="primary"
          isDisabled={isLoading}
          startContent={<IoIosAddCircleOutline size={22} />}
          className="font-bold"
          onPress={() => navigate("/cars/add-job", { state: { license } })}
        >
          Nuevo trabajo
        </Button>
      </div>

      <JobsTable
        jobs={jobs}
        isLoading={isLoading}
        noRowsLabel="No hay trabajos registrados"
        onEditJob={handleOpenEdit}
      />

      {/* Modal de edición */}
      <Modal
        isOpen={!!editingJob}
        onClose={handleCloseEdit}
        placement="center"
        backdrop="blur"
        hideCloseButton
        size="lg"
      >
        <ModalContent>
          <ModalHeader className="flex items-center gap-2 text-xl font-bold">
            <MdEdit size={20} />
            Editar trabajo
          </ModalHeader>

          <ModalBody className="flex flex-col gap-4">
            {editingJob && (
              <>
                {/* Descripción (solo lectura) */}
                <p className="text-foreground-400 text-sm bg-foreground-100 rounded-lg p-3 border border-foreground-200">
                  {editingJob.description}
                </p>

                {/* Estado */}
                <Select
                  label="Estado"
                  selectedKeys={[editStatus]}
                  onSelectionChange={(keys) => {
                    const val = Array.from(keys)[0] as JobStatus;
                    if (val) setEditStatus(val);
                  }}
                  color={
                    editStatus === JobStatus.IN_PROGRESS
                      ? "primary"
                      : editStatus === JobStatus.COMPLETED
                        ? "success"
                        : editStatus === JobStatus.DELIVERED
                          ? "secondary"
                          : "default"
                  }
                >
                  {Object.values(JobStatus).map((s) => (
                    <SelectItem
                      key={s}
                      color={
                        s === JobStatus.IN_PROGRESS
                          ? "primary"
                          : s === JobStatus.COMPLETED
                            ? "success"
                            : s === JobStatus.DELIVERED
                              ? "secondary"
                              : "default"
                      }
                      className={
                        s === JobStatus.IN_PROGRESS
                          ? "text-primary"
                          : s === JobStatus.COMPLETED
                            ? "text-success"
                            : s === JobStatus.DELIVERED
                              ? "text-secondary"
                              : "text-default-700"
                      }
                    >
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </Select>

                {/* ── Sección repuestos ── */}
                <div className="flex flex-col gap-2 p-3 rounded-lg">
                  <h6 className="font-semibold text-sm uppercase tracking-wide">
                    Repuestos
                  </h6>

                  {/* Inputs para agregar */}
                  <div className="flex gap-2 items-start">
                    <Input
                      size="sm"
                      label="Nombre del repuesto"
                      value={partName}
                      onChange={(e) => {
                        setPartName(e.target.value);
                        if (e.target.value.trim()) setPartNameError("");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddPart();
                        }
                      }}
                      isInvalid={!!partNameError}
                      errorMessage={partNameError}
                      className="flex-1"
                    />
                    <Input
                      size="sm"
                      label="Precio"
                      type="text"
                      startContent={
                        <span className="text-foreground-900 font-bold">$</span>
                      }
                      inputMode="numeric"
                      value={formatThousands(partPrice)}
                      onChange={(e) => {
                        const val = parseNumber(e.target.value);
                        setPartPrice(val || undefined);
                        if (val > 0) setPartPriceError("");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddPart();
                        }
                      }}
                      isInvalid={!!partPriceError}
                      errorMessage={partPriceError}
                      className="w-32"
                    />
                    <Button
                      isIconOnly
                      size="sm"
                      color="primary"
                      className="mt-1 shrink-0"
                      onPress={handleAddPart}
                    >
                      <MdAdd size={18} />
                    </Button>
                  </div>

                  {/* Lista de repuestos */}
                  <div
                    className={`flex flex-col gap-2 max-h-50 overflow-auto pr-1`}
                  >
                    {editParts.length === 0 ? (
                      <div className="flex items-center justify-center text-foreground-400 text-xs border border-dashed border-foreground-500 rounded-lg py-4">
                        No hay repuestos agregados
                      </div>
                    ) : (
                      <>
                        {editParts.map((part, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between px-3 py-1.5 rounded-md bg-foreground-100"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Chip
                                size="sm"
                                color="primary"
                                variant="flat"
                                className="text-primary"
                              >
                                {i + 1}
                              </Chip>
                              <span className="text-sm truncate">
                                {part.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              <span className="text-sm font-medium text-primary-600">
                                {formatARS(part.price)}
                              </span>
                              <Button
                                isIconOnly
                                size="sm"
                                variant="flat"
                                color="danger"
                                className="text-danger"
                                onPress={() => handleRemovePart(i)}
                                isDisabled={isLoading || updating}
                              >
                                <MdDelete size={15} />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                  {totalParts > 0 && (
                    <div className="flex justify-between items-center px-3 py-2 rounded-md bg-foreground-200 border border-primary-700 mt-1">
                      <span className="text-sm">
                        Total repuestos
                        <Chip
                          color="primary"
                          size="sm"
                          variant="flat"
                          className="text-primary"
                        >
                          {editParts.length}
                        </Chip>
                      </span>
                      <span className="text-sm font-bold text-primary-600">
                        {formatARS(totalParts)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Precio del trabajo */}
                <Input
                  label="Precio"
                  startContent={
                    <span className="text-foreground-900 font-bold">$</span>
                  }
                  type="text"
                  inputMode="numeric"
                  value={formatThousands(editPrice)}
                  isInvalid={!isPriceValid}
                  errorMessage={
                    !isPriceValid ? "El precio debe ser mayor a 0" : undefined
                  }
                  onChange={(e) => setEditPrice(parseNumber(e.target.value))}
                />
              </>
            )}
          </ModalBody>

          <ModalFooter>
            <Button color="danger" variant="flat" onPress={handleCloseEdit}>
              Cancelar
            </Button>
            <Button
              color="primary"
              isLoading={updating}
              isDisabled={!canSave || updating}
              onPress={handleSaveEdit}
            >
              Guardar cambios
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};

export default Jobs;
