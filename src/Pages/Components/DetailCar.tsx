import React from "react";
import { Cars } from "../../Types/types";
import { MdCancel, MdEdit } from "react-icons/md";
import { Button } from "@heroui/react";
import AddCarForm from "../../Components/Forms/AddCarForm";
import { useCarQueries } from "../../Hooks/useCarQueries";
import { useClientQueries } from "../../Hooks/useClientQueries";
import { CreateCarBody } from "../../Types/apiTypes";
import { useToasts } from "../../Hooks/useToasts";

interface DetailCarProps {
  car: Cars;
  isLoading: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onRefresh: (licence: string) => Promise<unknown>;
}

const DetailCar: React.FC<DetailCarProps> = ({
  car,
  isLoading,
  isEditing,
  onEdit,
  onRefresh,
}) => {
  const {showToast} = useToasts()
  const { updateCar } = useCarQueries();
  const { updateOwner } = useClientQueries();

  const handleSubmit = async (data: CreateCarBody): Promise<void> => {
    try {
      await updateCar(car.id, data.kilometers);
      await updateOwner(data.owner);
      await onRefresh(car.licensePlate);
      onEdit();
      showToast("Vehículo y Titular actualizados correctamente", "success", "Actualización")
    } catch (error) {
      showToast("Error al actualizar datos", "danger", "Actualización")
      throw error
    }
  };

  return (
    <div className="flex flex-col text-white">
      <section className="flex justify-end items-center px-3">
        <Button
          color={isEditing ? "danger" : "default"}
          startContent={
            isEditing ? <MdCancel size={18} /> : <MdEdit size={18} />
          }
          onPress={onEdit}
        >
          {isEditing ? "Cancelar Edición" : "Editar"}
        </Button>
      </section>
      <AddCarForm
        isEditing={isEditing}
        readonly={!isEditing}
        isLoading={isLoading}
        initialValues={car}
        onSubmit={handleSubmit}
      />
    </div>
  );
};

export default DetailCar;
