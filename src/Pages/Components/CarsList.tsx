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
  /** Cuántos esqueletos mostrar en la primera carga (idealmente, el tamaño de página). */
  skeletonCount?: number;
}

// Mismas clases para esqueletos y tarjetas: si la grilla cambiara de forma
// entre un estado y otro, el alto saltaría al terminar la carga.
const GRID =
  "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 p-3";

const CarsList: React.FC<CarsListProps> = ({
  cars,
  selectedLicense,
  isLoading = false,
  skeletonCount = 8,
  onSelect,
}) => {
  const navigate = useNavigate();

  // Primera carga: todavía no hay nada que mostrar, así que van esqueletos.
  if (isLoading && cars.length === 0) {
    return (
      <div className={GRID} aria-busy="true">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div
            key={i}
            className="w-full h-40 rounded-xl bg-content2 border-2 border-divider animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (cars.length === 0) {
    return (
      <div className="mt-4 flex flex-col items-center justify-center gap-4 py-12 px-6 rounded-xl border-2 border-dashed border-divider bg-content2/50 text-center">
        <div className="p-4 rounded-full bg-content3">
          <IoCarSportSharp size={32} className="text-foreground-400" />
        </div>
        <div>
          <p className="text-foreground font-semibold text-lg">
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

  // Recargas (cambio de página o búsqueda): las tarjetas actuales se mantienen
  // montadas y sólo se atenúan. Reemplazarlas por esqueletos hacía colapsar el
  // alto de la grilla y volver a expandirlo: ese era el parpadeo.
  return (
    <div
      className={`${GRID} transition-opacity duration-200 ${
        isLoading ? "opacity-50 pointer-events-none" : "opacity-100"
      }`}
      aria-busy={isLoading}
    >
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
