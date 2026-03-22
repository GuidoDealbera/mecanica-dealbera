import React from "react";
import { Cars } from "../../Types/types";
import { Card, CardBody, CardHeader, Divider, Chip } from "@heroui/react";
import LicenceTable from "../../Components/Licenses/LicenceTable";
import { MdCheckCircle } from "react-icons/md";
import { IoCarSportSharp } from "react-icons/io5";

interface CarCardProps extends Cars {
  isSelected: boolean;
  onSelect: (license: string) => void;
}

const CarCard: React.FC<CarCardProps> = ({
  brand,
  kilometers,
  licensePlate,
  model,
  owner,
  year,
  isSelected,
  onSelect,
}) => {
  return (
    <Card
      isPressable
      onPress={() => onSelect(licensePlate)}
      className={`
        w-full max-w-fit transition-all duration-200 border-2
        ${
          isSelected
            ? "bg-primary-700 border-primary-400 shadow-lg shadow-primary-900/60"
            : "bg-foreground-700 border-foreground-600 hover:border-primary-500 hover:shadow-md hover:shadow-primary-900/30"
        }
      `}
    >
      <CardHeader className="flex items-start justify-between gap-3 pb-2">
        <LicenceTable licence={licensePlate} dialog />
        <div className="flex flex-col items-end min-w-0">
          <p className="text-white font-semibold text-sm leading-tight truncate max-w-[140px]">
            {owner?.fullname ?? "---"}
          </p>
          <p
            className={`text-xs mt-0.5 ${isSelected ? "text-primary-200" : "text-foreground-400"}`}
          >
            Titular
          </p>
        </div>
      </CardHeader>

      <Divider
        className={isSelected ? "bg-primary-500" : "bg-foreground-600"}
      />

      <CardBody className="pt-3 pb-3 flex flex-col gap-3">
        {/* Marca y modelo */}
        <div className="flex items-center gap-1.5">
          <IoCarSportSharp
            size={14}
            className={
              isSelected
                ? "text-primary-200 flex-shrink-0"
                : "text-primary-400 flex-shrink-0"
            }
          />
          <span className="text-white font-medium text-sm truncate">
            {brand} {model}
          </span>
        </div>

        {/* Año y KM */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p
              className={`text-xs ${isSelected ? "text-primary-200" : "text-foreground-400"}`}
            >
              Año
            </p>
            <p className="text-white text-sm font-semibold">{year}</p>
          </div>
          <div className="text-right">
            <p
              className={`text-xs ${isSelected ? "text-primary-200" : "text-foreground-400"}`}
            >
              Kilometraje
            </p>
            <p className="text-white text-sm font-semibold">
              {(kilometers ?? 0).toLocaleString("es-AR")} km
            </p>
          </div>
          {/* Chip de seleccionado */}
          <Chip
            size="sm"
            color="primary"
            startContent={<MdCheckCircle size={12} />}
            className={`${!isSelected ? "opacity-0" : "opacity-100"} bg-primary-500/30 text-primary-100 border border-primary-400/50 ml-auto`}
          >
            Seleccionado
          </Chip>
        </div>
      </CardBody>
    </Card>
  );
};

export default CarCard;
