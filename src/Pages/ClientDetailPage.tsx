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
} from "react-icons/md";
import { IoCarSportSharp } from "react-icons/io5";
import LicenceTable from "../Components/Licenses/LicenceTable";
import { Client } from "../Types/types";
import { useToasts } from "../Hooks/useToasts";
import { useForm, Controller } from "react-hook-form";
import { handleCapitalizedChange } from "../Utils/utils";
 
const ClientDetailPage: React.FC = () => {
  const { fullname } = useParams<{ fullname: string }>();
  const navigate = useNavigate();
  const { showToast } = useToasts();
  const { client, getClientByName, updateOwner, loading } = useClientQueries();
  const { allCars, getAllCars } = useCarQueries();
  const [isEditing, setIsEditing] = React.useState(false);
 
  const decodedName = fullname ? decodeURIComponent(fullname) : "";
 
  const { control, handleSubmit, reset, formState: { isDirty, isValid } } =
    useForm<Partial<Client>>({ mode: "onChange" });
 
  React.useEffect(() => {
    if (decodedName) {
      getClientByName(decodedName);
    }
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
      showToast("Error al actualizar cliente", "danger", "Actualizar Cliente");
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
        <p className="text-danger text-xl font-semibold">Cliente no encontrado</p>
      </div>
    );
  }
 
  const infoItems = [
    { icon: <MdPhone size={18} />, label: "Teléfono", value: client.phone },
    { icon: <MdLocationOn size={18} />, label: "Dirección", value: client.address },
    { icon: <MdLocationCity size={18} />, label: "Localidad", value: client.city },
    { icon: <MdEmail size={18} />, label: "Correo", value: client.email || "---" },
  ];
 
  return (
    <div className="w-full min-h-full shadow shadow-primary bg-foreground-800 rounded-md p-4 text-white">
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-semibold text-4xl text-shadow-2xs text-shadow-primary">
          Detalle del cliente
        </h4>
        <div className="flex gap-2">
          <Button
            isLoading={loading}
            startContent={!loading ? <HiOutlineRefresh size={20} /> : undefined}
            color="primary"
            className="font-bold"
            onPress={() => getClientByName(decodedName)}
          >
            Actualizar
          </Button>
          <Button
            color={isEditing ? "danger" : "default"}
            startContent={isEditing ? <MdCancel size={18} /> : <MdEdit size={18} />}
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
        <Card className="col-span-full md:col-span-5 bg-foreground-700 shadow shadow-primary">
          <CardHeader className="pb-0">
            <h5 className="font-semibold text-xl text-primary-400">{client.fullname}</h5>
          </CardHeader>
          <Divider className="my-2 bg-primary-800" />
          <CardBody>
            {!isEditing ? (
              <div className="flex flex-col gap-3">
                {infoItems.map(({ icon, label, value }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="text-primary-400">{icon}</span>
                    <span className="text-foreground-400 text-sm">{label}:</span>
                    <span className="font-medium">{value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <form onSubmit={handleSubmit(handleSave)} className="flex flex-col gap-3">
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
 
        <Card className="col-span-full md:col-span-7 bg-foreground-700 shadow shadow-primary">
          <CardHeader className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <IoCarSportSharp size={20} className="text-primary-400" />
              <h5 className="font-semibold text-xl text-primary-400">
                Vehículos registrados
              </h5>
              <Chip size="sm" color="primary" variant="flat">
                {clientCars.length}
              </Chip>
            </div>
          </CardHeader>
          <Divider className="bg-primary-800" />
          <CardBody>
            {clientCars.length === 0 ? (
              <p className="text-foreground-400 text-center py-4">
                Sin vehículos registrados
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {clientCars.map((car) => (
                  <div
                    key={car.id}
                    className="flex items-center justify-between p-3 bg-foreground-800 rounded-lg cursor-pointer hover:bg-primary-800 transition-colors"
                    onClick={() => navigate(`/cars/${car.licensePlate}`)}
                  >
                    <LicenceTable licence={car.licensePlate} dialog />
                    <div className="flex flex-col items-center">
                      <span className="font-medium">{car.brand}</span>
                      <span className="text-foreground-400 text-sm">{car.model}</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="font-medium">{car.year}</span>
                      <span className="text-foreground-400 text-sm">Año</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="font-medium">{car.kilometers.toLocaleString()} km</span>
                      <span className="text-foreground-400 text-sm">Kilometraje</span>
                    </div>
                    <Chip size="sm" color="primary" variant="flat">
                      {car.jobs?.length ?? 0} trabajos
                    </Chip>
                  </div>
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
