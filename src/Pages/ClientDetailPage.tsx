import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useClientQueries } from "../Hooks/useClientQueries";
import { useCarQueries } from "../Hooks/useCarQueries";
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
} from "react-icons/md";
import { IoCarSportSharp } from "react-icons/io5";
import LicenceTable from "../Components/Licenses/LicenceTable";
import { Client } from "../Types/types";
import { useToasts } from "../Hooks/useToasts";
import { useForm, Controller } from "react-hook-form";
import { handleCapitalizedChange } from "../Utils/utils";

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
      <p className="text-white font-medium text-sm break-words">
        {value || "---"}
      </p>
    </div>
  </div>
);

const ClientDetailPage: React.FC = () => {
  const { fullname } = useParams<{ fullname: string }>();
  const navigate = useNavigate();
  const { showToast } = useToasts();
  const { client, getClientByName, updateOwner, loading } = useClientQueries();
  const { allCars, getAllCars } = useCarQueries();
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

  React.useEffect(() => {
    getAllCars();
  }, [getAllCars]);

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

  const clientCars = React.useMemo(() => {
    if (!client) return [];
    return allCars.filter((car) => car.owner?.fullname === client.fullname);
  }, [allCars, client]);

  const handleSave = async (data: Partial<Client>) => {
    try {
      await updateOwner({ ...data, fullname: client?.fullname }, true);
      await getClientByName(decodedName);
      setIsEditing(false);
    } catch {
      showToast("Error al actualizar cliente", "danger", "Actualizar cliente");
    }
  };

  if (loading && !client) {
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
    <div className="w-full min-h-full shadow shadow-primary bg-foreground-800 rounded-md p-4 text-white">
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

      <div className="grid grid-cols-12 gap-4">
        {/* ── Card izquierda: info del cliente ── */}
        <Card className="col-span-full md:col-span-5 bg-foreground-800 border border-foreground-600 shadow-none">
          <CardHeader className="flex items-center gap-2 pb-2">
            <MdPerson size={18} className="text-primary-400" />
            <h5 className="font-semibold text-base text-primary-400">
              {client.fullname}
            </h5>
            <Chip
              color={client.isActive ? "success" : "danger"}
              className="ml-auto"
            >
              {client.isActive ? "Activo" : "Inactivo"}
            </Chip>
          </CardHeader>
          <Divider className="bg-foreground-600" />
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
        <Card className="col-span-full md:col-span-7 bg-foreground-800 border border-foreground-600 shadow-none">
          <CardHeader className="flex items-center gap-2 pb-2">
            <IoCarSportSharp size={18} className="text-primary-400" />
            <h5 className="font-semibold text-base text-primary-400">
              Vehículos registrados
            </h5>
            <Chip size="sm" color="primary" className="ml-1">
              {clientCars.length}
            </Chip>
          </CardHeader>
          <Divider className="bg-foreground-600" />
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
                    className="w-full flex items-center gap-3 p-3 bg-foreground-800 rounded-lg
                               hover:bg-foreground-600 transition-colors text-left
                               border border-transparent hover:border-foreground-500"
                  >
                    <LicenceTable licence={car.licensePlate} dialog />

                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm">
                        {car.brand} {car.model}
                      </p>
                      <p className="text-foreground-400 text-xs">
                        {car.year} · {(car.kilometers ?? 0).toLocaleString("es-AR")} km
                      </p>
                    </div>

                    <Chip size="sm" color="primary" className="flex-shrink-0">
                      {car.jobs?.length ?? 0} trabajos
                    </Chip>

                    <MdChevronRight size={18} className="text-foreground-500 flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
};

export default ClientDetailPage;