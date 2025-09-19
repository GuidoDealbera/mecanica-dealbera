import React from "react";
import AddCarForm from "../Components/Forms/AddCarForm";
import { useToasts } from "../Hooks/useToasts";
import { useCarQueries } from "../Hooks/useCarQueries";
import { CreateCarBody } from "../Types/apiTypes";
import { CarActions } from "../Constants/car.constants";

const AddCarPage: React.FC = () => {
  const { loading, create } = useCarQueries();
  const { showToast } = useToasts();
  const handleSubmit = async (data: CreateCarBody) => {
    try {
      await create(data);
    } catch (error) {
      if (error instanceof Error) {
        showToast(error.message, "danger", CarActions.CREATE);
      } else {
        showToast("Error al registrar automóvil", "danger", CarActions.CREATE);
      }
    }
  };
  return (
    <div className="text-white shadow shadow-primary bg-foreground-800 rounded-md p-3 min-h-full">
      <h4 className="mb-1 font-semibold text-4xl text-shadow-2xs text-shadow-primary">
        Ingresar nuevo vehículo
      </h4>
      <AddCarForm
        isLoading={loading}
        onSubmit={handleSubmit}
        isEditing={false}
      />
    </div>
  );
};

export default AddCarPage;
