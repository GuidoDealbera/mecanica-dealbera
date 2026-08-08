import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useClientQueries } from "../Hooks/useClientQueries";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Divider,
  Spinner,
  Input,
} from "@heroui/react";
import { HiOutlineRefresh } from "react-icons/hi";
import {
  MdEmail,
  MdPhone,
  MdLocationOn,
  MdLocationCity,
  MdEdit,
  MdCancel,
  MdPerson,
  MdChevronRight,
  MdBuild,
  MdPendingActions,
  MdAttachMoney,
  MdHistory,
} from "react-icons/md";
import { IoCarSportSharp } from "react-icons/io5";
import LicenceTable from "../Components/Licenses/LicenceTable";
import ClientHistory from "./Components/ClientHistory";
import { Client } from "../Types/types";
import { JobStatus } from "../Types/apiTypes";
import { useToasts } from "../Hooks/useToasts";
import { useForm, Controller } from "react-hook-form";
import { formatARS, formatDate, handleCapitalizedChange } from "../Utils/utils";

// Campo de solo lectura reutilizable
const InfoRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | undefined | null;
}> = ({ icon, label, value }) => (
  <div className="flex items-start gap-3">
    <span className="text-primary-400 mt-0.5 flex-shrink-0">{icon}</span>
    <div className="min-w-0">
      <p className="text-foreground-400 text-xs">{label}</p>
      <p className="text-foreground font-medium text-sm break-words">
        {value || "---"}
      </p>
    </div>
  </div>
);

// Tarjeta de estadística para el resumen de actividad
const StatTile: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent?: string;
}> = ({ icon, label, value, accent = "text-foreground" }) => (
  <div className="flex flex-col gap-1 p-3 rounded-xl bg-content2 border border-divider">
    <div className="flex items-center gap-1.5 text-foreground-400">
      {icon}
      <span className="text-xs">{label}</span>
    </div>
    <span className={`text-xl font-bold break-words ${accent}`}>{value}</span>
  </div>
);

const ClientDetailPage: React.FC = () => {
  const { fullname } = useParams<{ fullname: string }>();
  const navigate = useNavigate();
  const { showToast } = useToasts();
  const {
    client,
    clientLoaded,
    getClientByName,
    updateOwner,
    loading,
    clearClient,
  } = useClientQueries();
  const [isEditing, setIsEditing] = React.useState(false);

  const decodedName = fullname ? decodeURIComponent(fullname) : "";

  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty, isValid },
  } = useForm<Partial<Client>>({ mode: "onChange" });

  React.useEffect(() => {
    if (decodedName) getClientByName(decodedName);
  }, [decodedName, getClientByName]);

  // Limpieza al desmontar: sin esto `clientLoaded` queda en `true` con el
  // cliente anterior en el store, y al abrir otra ficha se vería la vieja
  // hasta que llegue la respuesta.
  React.useEffect(() => {
    return () => {
      clearClient();
    };
  }, [clearClient]);

  React.useEffect(() => {
    if (client) {
      reset({
        phone: client.phone,
        address: client.address,
        city: client.city,
        email: client.email ?? "",
      });
    }
  }, [client, reset]);

  // Los vehículos vienen en la propia relación del cliente (client:find-by-name
  // carga `cars` y `cars.jobs`), así que no hace falta traer todos los autos.
  const clientCars = React.useMemo(() => client?.cars ?? [], [client]);

  // Resumen de actividad: se calcula sobre los trabajos de todos los vehículos
  // del cliente. "Facturado" suma solo los trabajos completados/entregados.
  const activity = React.useMemo(() => {
    const jobs = clientCars.flatMap((car) => car.jobs ?? []);
    const activeJobs = jobs.filter(
      (j) =>
        j.status === JobStatus.PENDING || j.status === JobStatus.IN_PROGRESS
    ).length;
    const billed = jobs
      .filter(
        (j) =>
          j.status === JobStatus.COMPLETED || j.status === JobStatus.DELIVERED
      )
      .reduce((sum, j) => sum + (j.price ?? 0), 0);
    const lastJobDate = jobs.reduce<string | null>((latest, j) => {
      const d = j.updatedAt || j.createdAt;
      if (!d) return latest;
      if (!latest) return d;
      return new Date(d) > new Date(latest) ? d : latest;
    }, null);
    return {
      vehicles: clientCars.length,
      totalJobs: jobs.length,
      activeJobs,
      billed,
      lastJobDate,
    };
  }, [clientCars]);

  const handleSave = async (data: Partial<Client>) => {
    if (!client) return;
    try {
      await updateOwner({ ...data, id: client.id }, true);
      await getClientByName(decodedName);
      setIsEditing(false);
    } catch {
      showToast("Error al actualizar cliente", "danger", "Actualizar cliente");
    }
  };

  // Hasta que la consulta se resuelve por primera vez no se puede saber si el
  // cliente existe (`client` es `undefined` tanto si no cargó como si no
  // existe). Sin esto el primer render —anterior al efecto que dispara el
  // fetch— pinta "Cliente no encontrado" por un frame.
  if (!clientLoaded) {
    return (
      <div className="w-full h-full flex justify-center items-center">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="w-full h-full flex justify-center items-center">
        <p className="text-danger text-xl font-semibold">
          Cliente no encontrado
        </p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-full shadow shadow-primary bg-content1 rounded-md p-4 text-foreground">
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <h4 className="font-semibold text-4xl text-shadow-2xs text-shadow-primary">
          Detalle del cliente
        </h4>
        <div className="flex gap-2">
          <Button
            isLoading={loading}
            startContent={!loading ? <HiOutlineRefresh size={18} /> : undefined}
            color="primary"
            onPress={() => getClientByName(decodedName)}
          >
            {loading ? "Actualizando..." : "Actualizar"}
          </Button>
          <Button
            color={isEditing ? "danger" : "default"}
            startContent={
              isEditing ? <MdCancel size={16} /> : <MdEdit size={16} />
            }
            onPress={() => {
              setIsEditing(!isEditing);
              if (isEditing) reset();
            }}
          >
            {isEditing ? "Cancelar" : "Editar"}
          </Button>
        </div>
      </div>

      {/* ── Resumen de actividad ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
        <StatTile
          icon={<IoCarSportSharp size={14} />}
          label="Vehículos"
          value={activity.vehicles}
          accent="text-primary-300"
        />
        <StatTile
          icon={<MdBuild size={14} />}
          label="Trabajos"
          value={activity.totalJobs}
        />
        <StatTile
          icon={<MdPendingActions size={14} />}
          label="Activos"
          value={activity.activeJobs}
          accent="text-warning-300"
        />
        <StatTile
          icon={<MdAttachMoney size={14} />}
          label="Facturado"
          value={formatARS(activity.billed)}
          accent="text-success-300"
        />
        <StatTile
          icon={<MdHistory size={14} />}
          label="Último trabajo"
          value={activity.lastJobDate ? formatDate(activity.lastJobDate) : "—"}
        />
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* ── Card izquierda: info del cliente ── */}
        <Card className="col-span-full md:col-span-5 bg-content1 border border-divider shadow-none">
          <CardHeader className="flex items-center gap-2 pb-2">
            <MdPerson size={18} className="text-primary-400" />
            <h5 className="font-semibold text-base text-primary-400">
              {client.fullname}
            </h5>
            <Chip
              color={client.isActive ? "success" : "danger"}
              variant="flat"
              className="ml-auto text-success"
            >
              {client.isActive ? "Activo" : "Inactivo"}
            </Chip>
          </CardHeader>
          <Divider className="bg-content3" />
          <CardBody className="pt-4">
            {!isEditing ? (
              <div className="flex flex-col gap-4">
                <InfoRow
                  icon={<MdPhone size={16} />}
                  label="Teléfono"
                  value={client.phone}
                />
                <InfoRow
                  icon={<MdLocationOn size={16} />}
                  label="Dirección"
                  value={client.address}
                />
                <InfoRow
                  icon={<MdLocationCity size={16} />}
                  label="Localidad"
                  value={client.city}
                />
                <InfoRow
                  icon={<MdEmail size={16} />}
                  label="Correo electrónico"
                  value={client.email}
                />
              </div>
            ) : (
              <form
                onSubmit={handleSubmit(handleSave)}
                className="flex flex-col gap-3"
              >
                <Controller
                  control={control}
                  name="phone"
                  rules={{ required: "Campo obligatorio" }}
                  render={({ field, fieldState: { error } }) => (
                    <Input
                      {...field}
                      label="Teléfono"
                      isInvalid={!!error}
                      errorMessage={error?.message}
                      onChange={(e) =>
                        field.onChange(e.target.value.replace(/[^\d+]/g, ""))
                      }
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="address"
                  rules={{ required: "Campo obligatorio" }}
                  render={({ field, fieldState: { error } }) => (
                    <Input
                      {...field}
                      label="Dirección"
                      isInvalid={!!error}
                      errorMessage={error?.message}
                      onChange={handleCapitalizedChange(field.onChange)}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="city"
                  rules={{ required: "Campo obligatorio" }}
                  render={({ field, fieldState: { error } }) => (
                    <Input
                      {...field}
                      label="Localidad"
                      isInvalid={!!error}
                      errorMessage={error?.message}
                      onChange={handleCapitalizedChange(field.onChange)}
                    />
                  )}
                />
                <Controller
                  control={control}
                  name="email"
                  rules={{
                    pattern: {
                      value: /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/,
                      message: "Correo inválido",
                    },
                  }}
                  render={({ field, fieldState: { error } }) => (
                    <Input
                      {...field}
                      type="email"
                      label="Correo electrónico"
                      isInvalid={!!error}
                      errorMessage={error?.message}
                    />
                  )}
                />
                <Button
                  type="submit"
                  color="primary"
                  fullWidth
                  isLoading={loading}
                  isDisabled={!isDirty || !isValid}
                >
                  Guardar cambios
                </Button>
              </form>
            )}
          </CardBody>
        </Card>

        {/* ── Card derecha: vehículos del cliente ── */}
        <Card className="col-span-full md:col-span-7 bg-content1 border border-divider shadow-none">
          <CardHeader className="flex items-center gap-2 pb-2">
            <IoCarSportSharp size={18} className="text-primary-400" />
            <h5 className="font-semibold text-base text-primary-400">
              Vehículos registrados
            </h5>
            <Chip
              size="sm"
              color="primary"
              variant="flat"
              className="ml-1 text-primary"
            >
              {clientCars.length}
            </Chip>
          </CardHeader>
          <Divider className="bg-content3" />
          <CardBody className="pt-3">
            {clientCars.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <IoCarSportSharp size={28} className="text-foreground-500" />
                <p className="text-foreground-400 text-sm">
                  Sin vehículos registrados
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {clientCars.map((car) => (
                  <button
                    key={car.id}
                    type="button"
                    onClick={() => navigate(`/cars/${car.licensePlate}`)}
                    className="w-full flex items-center gap-3 p-3 bg-content1 rounded-lg
                               hover:bg-content3 transition-colors text-left
                               border border-transparent hover:border-default-400"
                  >
                    <LicenceTable licence={car.licensePlate} dialog />

                    <div className="flex-1 min-w-0">
                      <p className="text-foreground font-medium text-sm">
                        {car.brand} {car.model}
                      </p>
                      <p className="text-foreground-400 text-xs">
                        {car.year} ·{" "}
                        {(car.kilometers ?? 0).toLocaleString("es-AR")} km
                      </p>
                    </div>

                    <Chip
                      size="sm"
                      color="primary"
                      variant="flat"
                      className="flex-shrink-0 text-foreground"
                    >
                      {car.jobs?.length ?? 0} trabajos
                    </Chip>

                    <MdChevronRight
                      size={18}
                      className="text-foreground-500 flex-shrink-0"
                    />
                  </button>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        {/* ── Historial cruzado: actividad de todos sus vehículos ── */}
        <Card className="col-span-full bg-content1 border border-divider shadow-none">
          <CardHeader className="flex items-center gap-2 pb-2">
            <MdHistory size={18} className="text-primary-400" />
            <h5 className="font-semibold text-base text-primary-400">
              Historial de actividad
            </h5>
            <span className="text-foreground-400 text-xs ml-1">
              Todos los vehículos del cliente
            </span>
          </CardHeader>
          <Divider className="bg-content3" />
          <CardBody className="pt-3">
            <ClientHistory cars={clientCars} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
};

export default ClientDetailPage;
