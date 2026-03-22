import React from "react";
import { Jobs as CarJobs } from "../../Types/types";
import JobsTable from "../../Components/Tables/JobsTable";
import { Button, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Select, SelectItem } from "@heroui/react";
import { IoIosAddCircleOutline } from "react-icons/io";
import { useNavigate } from "react-router-dom";
import { JobStatus, STATUS_LABELS, UpdateJobBody } from "../../Types/apiTypes";
import { useCarQueries } from "../../Hooks/useCarQueries";
import { useToasts } from "../../Hooks/useToasts";
import { MdEdit } from "react-icons/md";
import { formatThousands, parseNumber } from "../../Utils/utils";

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

  const handleOpenEdit = React.useCallback((job: CarJobs) => {
    setEditingJob(job);
    setEditStatus(job.status);
    setEditPrice(job.price);
  }, []);

  const handleCloseEdit = React.useCallback(() => {
    setEditingJob(null);
  }, []);

  const handleSaveEdit = async () => {
    if (!editingJob || !license) return;

    const hasChanges =
      editStatus !== editingJob.status || editPrice !== editingJob.price;

    if (!hasChanges) {
      showToast("No hay cambios para guardar", "warning", "Editar trabajo");
      handleCloseEdit();
      return;
    }

    const body: UpdateJobBody = {};

    if (editStatus !== editingJob.status) body.status = editStatus;
    if (editPrice !== editingJob.price) body.price = editPrice;

    await updateJob(license, editingJob.id, body);
    handleCloseEdit();
  };

  const isPriceValid = editPrice > 0;
  const canSave =
    editingJob !== null &&
    isPriceValid &&
    (editStatus !== editingJob.status || editPrice !== editingJob.price);

  return (
    <div className="w-full min-h-full shadow shadow-primary bg-foreground-800 rounded-md p-3">
      <div className="flex justify-end items-center mb-4">
        <Button
          color="primary"
          isDisabled={isLoading}
          startContent={<IoIosAddCircleOutline size={22} />}
          className="font-bold"
          onPress={() =>
            navigate("/cars/add-job", {
              state: {
                license,
              },
            })
          }
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

      {/* Modal de edición de trabajo */}
      <Modal
        isOpen={!!editingJob}
        onClose={handleCloseEdit}
        placement="center"
        backdrop="blur"
        hideCloseButton
      >
        <ModalContent>
          <ModalHeader className="flex items-center gap-2 text-xl font-bold">
            <MdEdit size={20} />
            Editar trabajo
          </ModalHeader>
          <ModalBody className="flex flex-col gap-4">
            {editingJob && (
              <>
                <p className="text-foreground-400 text-sm bg-foreground-100 rounded-lg p-3 border border-foreground-200">
                  {editingJob.description}
                </p>
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
                <Input
                  label="Precio"
                  startContent="$"
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
            <Button color="danger" onPress={handleCloseEdit}>
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
