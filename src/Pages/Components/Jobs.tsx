import React from "react";
import { Jobs as CarJobs } from "../../Types/types";
import JobsTable from "../../Components/Tables/JobsTable";
import {
  Button,
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
import { MdEdit } from "react-icons/md";
import { formatThousands, parseNumber } from "../../Utils/utils";
import PartsEditor from "../../Components/Parts/PartsEditor";
import { Input, Textarea } from "@heroui/react";

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
    JobStatus.PENDING
  );
  const [editPrice, setEditPrice] = React.useState<number>(0);
  const [editParts, setEditParts] = React.useState<
    { name: string; price: number }[]
  >([]);
  const [editNotes, setEditNotes] = React.useState<string>("");
  const [editIsService, setEditIsService] = React.useState(false);

  const handleOpenEdit = React.useCallback((job: CarJobs) => {
    setEditingJob(job);
    setEditStatus(job.status);
    setEditPrice(job.price);
    setEditParts(job.parts ?? []);
    setEditNotes(job.notes ?? "");
    setEditIsService(job.isService ?? false);
  }, []);

  const handleCloseEdit = React.useCallback(() => {
    setEditingJob(null);
  }, []);

  // Cambio rápido de estado desde el listado (sin abrir el modal). `updateJob`
  // ya emite el toast y actualiza el trabajo en el store.
  const handleQuickStatus = React.useCallback(
    async (job: CarJobs, status: JobStatus) => {
      if (!license || status === job.status) return;
      await updateJob(license, job.id, { status });
    },
    [license, updateJob]
  );

  const handleSaveEdit = async () => {
    if (!editingJob || !license) return;

    const partsChanged =
      JSON.stringify(editParts) !== JSON.stringify(editingJob.parts ?? []);
    const notesChanged = editNotes !== (editingJob.notes ?? "");
    const isServiceChanged = editIsService !== (editingJob.isService ?? false);

    const hasChanges =
      editStatus !== editingJob.status ||
      editPrice !== editingJob.price ||
      partsChanged ||
      notesChanged ||
      isServiceChanged;

    if (!hasChanges) {
      showToast("No hay cambios para guardar", "warning", "Editar trabajo");
      handleCloseEdit();
      return;
    }

    const body: UpdateJobBody = {};
    if (editStatus !== editingJob.status) body.status = editStatus;
    if (editPrice !== editingJob.price) body.price = editPrice;
    if (partsChanged) body.parts = editParts;
    if (notesChanged) body.notes = editNotes;
    if (isServiceChanged) body.isService = editIsService;

    const response = await updateJob(license, editingJob.id, body);
    if (response?.status === "success") {
      handleCloseEdit();
    }
  };

  const isPriceValid = editPrice > 0;
  const partsChanged = editingJob
    ? JSON.stringify(editParts) !== JSON.stringify(editingJob.parts ?? [])
    : false;
  const notesChanged = editingJob
    ? editNotes !== (editingJob.notes ?? "")
    : false;
  const isServiceChanged = editingJob
    ? editIsService !== (editingJob.isService ?? false)
    : false;
  const canSave =
    editingJob !== null &&
    isPriceValid &&
    (editStatus !== editingJob.status ||
      editPrice !== editingJob.price ||
      partsChanged ||
      notesChanged ||
      isServiceChanged);

  return (
    <div className="w-full min-h-full shadow shadow-primary bg-content1 rounded-md p-3">
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
        onQuickStatusChange={handleQuickStatus}
        isUpdating={updating}
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
                <p className="text-foreground-400 text-sm bg-default-100 rounded-lg p-3 border border-default-200">
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

                {/* Sección repuestos */}
                <div className="flex flex-col gap-2 p-3 rounded-lg">
                  <h6 className="font-semibold text-sm uppercase tracking-wide">
                    Repuestos
                  </h6>
                  <PartsEditor
                    compact
                    parts={editParts}
                    onChange={setEditParts}
                    isDisabled={isLoading || updating}
                  />
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

                {/* Al pasar el trabajo a completado/entregado se programa el
                    próximo recordatorio del vehículo. */}
                <Select
                  label="¿Es un service?"
                  description="Si lo es, al completarlo se programa el próximo"
                  selectedKeys={[editIsService ? "true" : "false"]}
                  onSelectionChange={(keys) => {
                    setEditIsService(Array.from(keys)[0] === "true");
                  }}
                  isDisabled={updating}
                >
                  <SelectItem key="false">No, es un trabajo común</SelectItem>
                  <SelectItem key="true">Sí, es un service</SelectItem>
                </Select>

                {/* Notas internas */}
                <Textarea
                  label="Notas internas"
                  description="Uso interno del taller. No se incluyen en el presupuesto."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  minRows={2}
                  isDisabled={updating}
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
