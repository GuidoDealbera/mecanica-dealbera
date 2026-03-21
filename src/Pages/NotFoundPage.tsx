import { Button } from "@heroui/react";
import React from "react";
import { IoArrowBackCircle } from "react-icons/io5";
import { useNavigate } from "react-router-dom";

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="w-full h-screen p-10 text-white">
      <div className="w-full h-full shadow shadow-primary bg-foreground-800 rounded-md flex flex-col justify-center items-center gap-4">
        <h1 className="text-5xl">
          <span className="text-danger-500">Error</span> 404
        </h1>
        <h5 className="text-3xl">Página no encontrada</h5>
        <h6 className="w-80 text-justify text-lg">
          Haz click en el botón de abajo para volver a la navegación de la
          aplicación
        </h6>
        <Button
          startContent={<IoArrowBackCircle size={20} />}
          onPress={() => navigate(-1)}
          color="primary"
        >
          Volver atrás
        </Button>
      </div>
    </div>
  );
};

export default NotFoundPage;
