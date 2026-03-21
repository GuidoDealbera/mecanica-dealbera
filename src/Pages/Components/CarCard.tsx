import React from "react";
import { Cars } from "../../Types/types";
import { Card, CardBody, CardHeader } from "@heroui/react";
import LicenceTable from "../../Components/Licenses/LicenceTable";

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
  updatedAt,
  year,
  isSelected,
  onSelect,
}) => {
  const carInfo = [
    {
      label: "Marca",
      value: brand,
    },
    {
      label: "Modelo",
      value: model,
    },
    {
      label: "Año",
      value: year,
    },
    {
      label: "Kilometraje",
      value: kilometers,
    },
    {
      label: "Última modificación",
      value: updatedAt,
    },
  ];
  return (
    <Card
      isPressable
      onPress={() => {
        if (!isSelected) onSelect(licensePlate);
      }}
      className={`${isSelected ? "text-white bg-primary-700" : "text-white bg-foreground-900 hover:bg-primary-700 hover:shadow-lg shadow-primary-500 active:bg-primary-600"} w-80 cursor-pointer transition-all duration-200`}
    >
      <CardHeader className="flex justify-between align-middle gap-2">
        <LicenceTable licence={licensePlate} />
        <div className="flex flex-col justify-center text-center">
          <h5 className="text-lg">{owner.fullname}</h5>
          <h6 className="text-gray-400 text-sm font-bold">Titular</h6>
        </div>
      </CardHeader>
      <CardBody className="grid grid-cols-12">
        {carInfo.map(({ label, value }, i) => {
          const isLast = i === carInfo.length - 1;
          const isOdd = carInfo.length % 2 !== 0;

          return (
            <div
              key={i}
              className={`flex flex-col justify-center text-center ${
                isLast && isOdd ? "col-span-12" : "col-span-6"
              }`}
            >
              <h5>{value}</h5>
              <h6 className="text-gray-400 text-sm font-bold">{label}</h6>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
};

export default CarCard;
