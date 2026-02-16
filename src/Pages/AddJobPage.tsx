import React from "react";
import { useLocation } from "react-router-dom";
import AddJobForm from "../Components/Forms/AddJobForm";
import { useCarQueries } from "../Hooks/useCarQueries";
import CarsList from "./Components/CarsList";
import { CreateCarJob } from "../Types/apiTypes";

const AddJobPage: React.FC = () => {
  const { state } = useLocation();
  const { allCars, addCarJob, getAllCars, cleanCars } = useCarQueries();
  const [selectedLicense, setSelectedLicense] = React.useState<string>("");

  React.useEffect(() => {
    getAllCars();

    return () => cleanCars();
  }, [getAllCars, cleanCars]);

  React.useEffect(() => {
    if (state.licensePlate) {
      setSelectedLicense(state.licensePlate);
    }
  }, [selectedLicense, state]);

  const handleSubmit = async (data: CreateCarJob) => {
    return await addCarJob(selectedLicense, data);
  };

  return (
    <div className="text-white shadow shadow-primary bg-foreground-800 rounded-md p-3 min-h-full">
      <h4 className="mb-1 font-semibold text-4xl text-shadow-2xs text-shadow-primary">
        Registrar nuevo trabajo
      </h4>
      {!selectedLicense && (
        <h5 className="mt-4 font-semibold w-fit text-2xl py-2 px-4 bg-primary-700 rounded-md shadow shadow-primary-500">
          Seleccione un automóvil
        </h5>
      )}
      <CarsList
        cars={allCars}
        selectedLicense={selectedLicense}
        onSelect={setSelectedLicense}
      />

      <AddJobForm license={selectedLicense} onSubmit={handleSubmit} />
    </div>
  );
};

export default AddJobPage;
