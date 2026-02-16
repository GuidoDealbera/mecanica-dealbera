import React from "react";
import { Cars } from "../../Types/types";
import { useCarQueries } from "../../Hooks/useCarQueries";
import { MdCancel, MdCheckCircle, MdEdit } from "react-icons/md";
import { Button, Input, Tooltip } from "@heroui/react";

interface DetailCarProps {
  car: Cars;
  isLoading: boolean;
}

const DetailCar: React.FC<DetailCarProps> = ({ car, isLoading }) => {
  const [isEditing, setIsEditing] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [carKilometers, setCarKilometers] = React.useState<string>(
    car.kilometers.toString()
  );

  const { updateCar, getCarDetail } = useCarQueries();

  const handleSave = React.useCallback(async () => {
    if (error || carKilometers === "") return; // evita guardar con error
    try {
      await updateCar(car.id, Number(carKilometers));
      await getCarDetail(car.licensePlate);
    } finally {
      setIsEditing(false);
    }
  }, [car.id, carKilometers, car.licensePlate, updateCar, getCarDetail, error]);

  const handleCancel = () => {
    setCarKilometers(car.kilometers.toString());
    setError(null);
    setIsEditing(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;

    if (/^\d*$/.test(value)) {
      setCarKilometers(value);

      if (value === "") {
        setError("El kilometraje no puede estar vacío");
      } else if (Number(value) < car.kilometers) {
        setError("No se pueden bajar los kilómetros del automóvil");
      } else {
        setError(null);
      }
    }
  };

  const tooltipContent = (
    <Button
      isIconOnly
      onPress={handleSave}
      color="primary"
      isLoading={isLoading}
      isDisabled={
        isLoading ||
        !!error ||
        carKilometers === "" ||
        Number(carKilometers) === car.kilometers
      }
    >
      <MdCheckCircle size={25} />
    </Button>
  );

  return (
    <div className="flex flex-col text-white gap-2">
      <section className="w-full flex flex-col gap-2">
        <h5 className="font-semibold w-fit text-2xl py-2 px-4 bg-primary-700 rounded-md shadow shadow-primary-500">
          Datos del vehículo
        </h5>
        <section className="flex flex-col w-auto gap-2">
          <Input label="Marca" disabled value={car.brand.toUpperCase()} />
          <Input label="Modelo" disabled value={car.model.toUpperCase()} />
          <Input label="Año" disabled value={car.year.toString()} />
          <section className="relative">
            <Input
              label="Kilometraje"
              value={carKilometers}
              disabled={!isEditing}
              isInvalid={!!error}
              errorMessage={error || ""}
              onChange={handleChange}
            />

            {isEditing ? (
              <section className="absolute top-2 right-2 flex gap-2">
                {Number(carKilometers) === car.kilometers ? (
                  <Tooltip
                    content="Para guardar la edición se debe modificar el kilometraje"
                    placement="bottom-end"
                    className="bg-primary text-white font-Nunito w-48 text-center"
                  >
                    <span>{tooltipContent}</span>
                  </Tooltip>
                ) : (
                  tooltipContent
                )}
                <Button
                  isIconOnly
                  onPress={handleCancel}
                  color="danger"
                  isDisabled={isLoading}
                >
                  <MdCancel size={25} />
                </Button>
              </section>
            ) : (
              <Button
                isIconOnly
                className="absolute top-2 right-2"
                onPress={() => setIsEditing(true)}
                color="default"
                isLoading={isLoading}
                isDisabled={isLoading}
              >
                <MdEdit size={25} />
              </Button>
            )}
          </section>
        </section>
      </section>
      <section className="w-full flex flex-col gap-2">
        <h5 className="font-semibold w-fit text-2xl py-2 px-4 bg-primary-700 rounded-md shadow shadow-primary-500">
          Datos del titular
        </h5>
        <section className="flex flex-col w-auto gap-2">
          <Input label="Nombre" disabled value={car.owner.fullname} />
          <Input label="Teléfono" disabled value={car.owner.phone} />
          {car.owner.email && (
            <Input
              label="Correo Electrónico"
              disabled
              value={car.owner.email}
            />
          )}
        </section>
      </section>
    </div>
  );
};

export default DetailCar;
