import React from "react";
import { Cars } from "../../Types/types";
import CarCard from "./CarCard";
import { useNavigate } from "react-router-dom";
import { IoCarSportSharp } from "react-icons/io5";
import { Button } from "@heroui/react";

interface CarsListProps {
  cars: Cars[];
  selectedLicense: string;
  onSelect: (license: string) => void;
  isLoading?: boolean;
}

const CarsList: React.FC<CarsListProps> = ({
  cars,
  selectedLicense,
  isLoading = false,
  onSelect,
}) => {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="w-full h-40 rounded-xl bg-foreground-700 border-2 border-foreground-600 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (cars.length === 0) {
    return (
      <div className="mt-4 flex flex-col items-center justify-center gap-4 py-12 px-6 rounded-xl border-2 border-dashed border-foreground-600 bg-foreground-700/50 text-center">
        <div className="p-4 rounded-full bg-foreground-600">
          <IoCarSportSharp size={32} className="text-foreground-400" />
        </div>
        <div>
          <p className="text-white font-semibold text-lg">
            No hay vehículos registrados
          </p>
          <p className="text-foreground-400 text-sm mt-1">
            Para registrar un trabajo primero necesitás ingresar un vehículo.
          </p>
        </div>
        <Button
          color="primary"
          startContent={<IoCarSportSharp size={18} />}
          onPress={() => navigate("/cars/new")}
        >
          Ingresar vehículo
        </Button>
      </div>
    );
  }

  return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-3">
        {cars.map((car) => (
          <CarCard
            key={car.id}
            {...car}
            isSelected={car.licensePlate === selectedLicense}
            onSelect={onSelect}
          />
        ))}
      </div>
  );
};

export default CarsList;
