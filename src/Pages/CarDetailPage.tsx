import React from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Divider,
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
  Spinner,
} from "@heroui/react";
import { useCarQueries } from "../Hooks/useCarQueries";
import { useParams } from "react-router-dom";
import Jobs from "./Components/Jobs";
import { HiOutlineRefresh } from "react-icons/hi";
import {
  MdHistory,
  MdEdit,
  MdBuild,
  MdPerson,
  MdPhone,
  MdLocationOn,
  MdLocationCity,
  MdEmail,
} from "react-icons/md";
import { FaCube, FaTag } from "react-icons/fa";
import { IoCarSportSharp } from "react-icons/io5";
import LicenceTable from "../Components/Licenses/LicenceTable";
import KmHistoryModal from "./Components/KmHistoryModal";
import { useClientQueries } from "../Hooks/useClientQueries";
import { useToasts } from "../Hooks/useToasts";
import { CreateCarBody, JobStatus } from "../Types/apiTypes";
import BudgetButton from "../Components/BudgetButton";
import AddCarForm from "../Components/Forms/AddCarForm";
import ReassignOwnerModal from "./Components/ReassingOwnerModal";

// ── Campo de solo lectura reutilizable ─────────────────────────────────────
const InfoField: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number | undefined | null;
}> = ({ icon, label, value }) => (
  <div className="flex items-start gap-3">
    <span className="text-primary-400 mt-0.5 flex-shrink-0">{icon}</span>
    <div className="min-w-0">
      <p className="text-foreground-400 text-xs">{label}</p>
      <p className="text-white font-medium text-sm break-words">
        {value ?? "---"}
      </p>
    </div>
  </div>
);

const CarDetailPage: React.FC = () => {
  const { licence } = useParams();
  const [isEditing, setIsEditing] = React.useState<boolean>(false);
  const [kmHistoryOpen, setKmHistoryOpen] = React.useState<boolean>(false);
  const [reassignOpen, setReassignOpen] = React.useState<boolean>(false);

  const { car, getCarDetail, loading, refreshing, refreshCar, updateCar } =
    useCarQueries();
  const { updateOwner, getAllClients } = useClientQueries();
  const { showToast } = useToasts();
  const isLoading = loading || refreshing;

  React.useEffect(() => {
    if (licence) getCarDetail(licence);
  }, [getCarDetail, licence]);

  React.useEffect(() => {
    getAllClients();
  }, [getAllClients]);

  const handleSubmit = async (data: CreateCarBody): Promise<void> => {
    try {
      await updateCar(car!.id, data.kilometers);
      await updateOwner(data.owner);
      await getCarDetail(car!.licensePlate);
      setIsEditing(false);
      showToast(
        "Vehículo y titular actualizados correctamente",
        "success",
        "Actualización",
      );
    } catch {
      showToast("Error al actualizar datos", "danger", "Actualización");
    }
  };

  const jobs = React.useMemo(() => car?.jobs ?? [], [car?.jobs])
  const kmHistory = React.useMemo(() => car?.kmHistory ?? [], [car?.kmHistory])

  // ── Loading inicial ────────────────────────────────────────────────────
  if (isLoading && !car) {
    return (
      <div className="w-full h-full flex justify-center items-center">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  if (!car || !licence) {
    return (
      <div className="w-full h-full flex justify-center items-center">
        <p className="text-danger text-xl font-semibold">
          Vehículo no encontrado
        </p>
      </div>
    );
  }

  const jobsCount = car.jobs?.length ?? 0;
  const inProgress =
    car.jobs?.filter((j) => j.status === JobStatus.IN_PROGRESS).length ?? 0;
  const pending =
    car.jobs?.filter((j) => j.status === JobStatus.PENDING).length ?? 0;
  return (
    <div className="w-full bg-foreground-800 rounded-xl p-3 min-h-full flex flex-col gap-4 text-white">
      {/* ═══════════════════════════════════════════════════════════════════
          HERO CARD — identidad del vehículo
      ═══════════════════════════════════════════════════════════════════ */}
      <Card className="bg-foreground-800 border border-foreground-600 shadow-lg shadow-primary-900/20">
        <CardBody className="p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            {/* Patente */}
            <LicenceTable licence={licence} />

            {/* Divisor vertical (solo sm+) */}
            <div className="hidden sm:block w-px self-stretch bg-foreground-600" />

            {/* Identidad del auto */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <IoCarSportSharp
                  size={16}
                  className="text-primary-400 flex-shrink-0"
                />
                <h2 className="text-white font-bold text-xl truncate">
                  {car.brand} {car.model}
                </h2>
                <Chip
                  size="sm"
                  variant="flat"
                  color="primary"
                  className="text-primary-500"
                >
                  {car.year}
                </Chip>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="text-foreground-400">
                  <span className="text-white font-medium">
                    {(car.kilometers ?? 0).toLocaleString("es-AR")} km
                  </span>
                </span>
                <span className="text-foreground-600">·</span>
                <span className="text-foreground-400">
                  Titular:{" "}
                  <span className="text-white font-medium">
                    {car.owner?.fullname ?? "---"}
                  </span>
                </span>
              </div>
            </div>

            {/* Stats rápidos */}
            <div className="hidden md:flex items-center gap-3">
              <div className="text-center px-4 py-2 bg-foreground-700 rounded-xl border border-foreground-600">
                <p className="text-2xl font-bold text-white">{jobsCount}</p>
                <p className="text-foreground-400 text-xs">Trabajos</p>
              </div>
              {inProgress > 0 && (
                <div className="text-center px-4 py-2 bg-primary-900/50 rounded-xl border border-primary-700/50">
                  <p className="text-2xl font-bold text-primary-300">
                    {inProgress}
                  </p>
                  <p className="text-primary-400 text-xs">En curso</p>
                </div>
              )}
              {pending > 0 && (
                <div className="text-center px-4 py-2 bg-warning-900/50 rounded-xl border border-warning-700/50">
                  <p className="text-2xl font-bold text-warning-300">
                    {pending}
                  </p>
                  <p className="text-warning-400 text-xs">Sin comenzar</p>
                </div>
              )}
            </div>

            {/* Divisor vertical (solo md+) */}
            <div className="hidden md:block w-px self-stretch bg-foreground-600" />

            {/* Acciones */}
            <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
              <BudgetButton car={car} jobs={jobs} />
              <Button
                isDisabled={isEditing || isLoading}
                startContent={<MdHistory size={16} />}
                onPress={() => setKmHistoryOpen(true)}
              >
                Historial KM
              </Button>
              <Button
                color="primary"
                isLoading={isLoading}
                isDisabled={isEditing}
                startContent={
                  !refreshing ? <HiOutlineRefresh size={16} /> : undefined
                }
                onPress={() => refreshCar(licence)}
              >
                {refreshing ? "Actualizando..." : "Actualizar"}
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* ── CONTENIDO: dos columnas ───────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
        {/* Columna principal: trabajos */}
        <div className="xl:col-span-2">
          <Jobs jobs={jobs} isLoading={isLoading} license={licence} />
        </div>

        {/* Sidebar: info del vehículo + titular */}
        <div className="flex flex-col gap-4">
          {/* Card vehículo */}
          <Card className="bg-foreground-800 shadow shadow-primary">
            <CardHeader className="flex items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <IoCarSportSharp size={15} className="text-primary-400" />
                <h5 className="text-primary-400 font-semibold text-sm">
                  Vehículo
                </h5>
              </div>
              <Button
                size="sm"
                color="primary"
                startContent={<MdEdit size={13} />}
                onPress={() => setIsEditing(true)}
              >
                Editar
              </Button>
            </CardHeader>
            <Divider className="bg-foreground-600" />
            <CardBody className="pt-4 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <InfoField
                  icon={<FaTag size={14} />}
                  label="Marca"
                  value={car.brand}
                />
                <InfoField
                  icon={<FaCube size={14} />}
                  label="Modelo"
                  value={car.model}
                />
                <InfoField
                  icon={<MdBuild size={14} />}
                  label="Año"
                  value={car.year}
                />
                <InfoField
                  icon={<MdBuild size={14} />}
                  label="Kilometraje"
                  value={`${(car.kilometers ?? 0).toLocaleString("es-AR")} km`}
                />
              </div>
              <Divider className="bg-foreground-600" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-foreground-400 text-xs">Registrado</p>
                  <p className="text-foreground-300 text-xs mt-0.5">
                    {car.createdAt ?? "---"}
                  </p>
                </div>
                <div>
                  <p className="text-foreground-400 text-xs">Actualizado</p>
                  <p className="text-foreground-300 text-xs mt-0.5">
                    {car.updatedAt ?? "---"}
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Card titular */}
          <Card className="bg-foreground-800 shadow shadow-primary">
            <CardHeader className="flex items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <MdPerson size={15} className="text-primary-400" />
                <h5 className="text-primary-400 font-semibold text-sm">
                  Titular
                </h5>
              </div>
              <Button
                size="sm"
                color="primary"
                startContent={<MdPerson size={13}/>}
                onPress={() => setReassignOpen(true)}
              >
                Cambiar titular
              </Button>
            </CardHeader>
            <Divider className="bg-foreground-600" />
            <CardBody className="pt-4 flex flex-col gap-4">
              <InfoField
                icon={<MdPerson size={14} />}
                label="Nombre"
                value={car.owner?.fullname}
              />
              <InfoField
                icon={<MdPhone size={14} />}
                label="Teléfono"
                value={car.owner?.phone}
              />
              <InfoField
                icon={<MdLocationOn size={14} />}
                label="Dirección"
                value={car.owner?.address}
              />
              <InfoField
                icon={<MdLocationCity size={14} />}
                label="Localidad"
                value={car.owner?.city}
              />
              <InfoField
                icon={<MdEmail size={14} />}
                label="Correo"
                value={car.owner?.email || "---"}
              />
            </CardBody>
          </Card>
        </div>
      </div>

      {/* ── MODAL DE EDICIÓN ──────────────────────────────────────────── */}
      <Modal
        isOpen={isEditing}
        onClose={() => setIsEditing(false)}
        size="4xl"
        placement="center"
        backdrop="blur"
        scrollBehavior="inside"
      >
        <ModalContent className="bg-foreground-800">
          <ModalHeader className="flex items-center gap-2 text-lg font-bold text-gray-300">
            <MdEdit size={18} className="text-primary-400" />
            Editar vehículo — {licence}
          </ModalHeader>
          <Divider className="bg-primary-700" />
          <ModalBody className="py-4">
            <AddCarForm
              isEditing
              readonly={false}
              isLoading={loading}
              initialValues={car}
              onSubmit={handleSubmit}
            />
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Modal historial KM */}
      <KmHistoryModal
        isOpen={kmHistoryOpen}
        onClose={() => setKmHistoryOpen(false)}
        kmHistory={kmHistory}
        currentKm={car.kilometers}
        licensePlate={licence}
      />

      {/* Modal cambio de titular */}
      <ReassignOwnerModal
        isOpen={reassignOpen}
        onClose={() => setReassignOpen(false)}
        licensePlate={licence}
        currentOwnerName={car.owner?.fullname ?? ""}
        onSuccess={() => getCarDetail(licence)}
      />
    </div>
  );
};

export default CarDetailPage;
