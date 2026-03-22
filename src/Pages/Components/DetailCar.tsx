import React from "react";
import { Cars } from "../../Types/types";
import { Button } from "@heroui/react";
import { MdCancel, MdEdit } from "react-icons/md";
import AddCarForm from "../../Components/Forms/AddCarForm";
import { CreateCarBody } from "../../Types/apiTypes";

interface DetailCarProps {
  car: Cars;
  isLoading: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onRefresh: (licence: string) => Promise<unknown>;
  /** Si se pasa, el submit lo maneja el padre (CarDetailPage). Si no, maneja internamente. */
  onSubmit?: (data: CreateCarBody) => Promise<void>;
}

const DetailCar: React.FC<DetailCarProps> = ({
  car,
  isLoading,
  isEditing,
  onEdit,
  onSubmit,
}) => {
  return (
    <div className="flex flex-col gap-3">
      {/* Botón cancelar/editar — solo cuando no lo maneja el padre */}
      {!onSubmit && (
        <div className="flex justify-end">
          <Button
            size="sm"
            color={isEditing ? "danger" : "default"}
            startContent={isEditing ? <MdCancel size={15} /> : <MdEdit size={15} />}
            onPress={onEdit}
          >
            {isEditing ? "Cancelar edición" : "Editar"}
          </Button>
        </div>
      )}
      <AddCarForm
        isEditing={isEditing}
        readonly={!isEditing}
        isLoading={isLoading}
        initialValues={car}
        onSubmit={onSubmit ?? (async () => {})}
      />
    </div>
  );
};

export default DetailCar;