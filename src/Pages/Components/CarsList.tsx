import React from "react";
import { Cars } from "../../Types/types";
import CarCard from "./CarCard";

interface CarsListProps {
  cars: Cars[];
  selectedLicense: string;
  onSelect: (license: string) => void;
}

const CarsList: React.FC<CarsListProps> = ({
  cars,
  selectedLicense,
  onSelect,
}) => {
  return (
    <div className="bg-white m-3 p-3 rounded-lg">
      <div className="p-3 bg-foreground-800 flex flex-wrap gap-3 rounded-lg shadow shadow-primary">
        {cars.map((car) => (
          <CarCard
            key={car.id}
            {...car}
            isSelected={car.licensePlate === selectedLicense}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
};

export default CarsList;
