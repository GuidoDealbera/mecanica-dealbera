import React from "react";
import { Jobs as CarJobs } from "../../Types/types";
import JobsTable from "../../Components/Tables/JobsTable";
import { Button } from "@heroui/react";
import { IoIosAddCircleOutline } from "react-icons/io";
import { useNavigate } from "react-router-dom";
// import { useNavigate } from "react-router-dom";

interface JobsProps {
  jobs: CarJobs[];
  isLoading: boolean;
  license?: string
}

const Jobs: React.FC<JobsProps> = ({ jobs, isLoading, license }) => {
  const navigate = useNavigate();
  return (
    <div className="w-full min-h-full shadow shadow-primary bg-foreground-800 rounded-md p-3">
      <div className="flex justify-end items-center mb-4">
        <Button
          color="primary"
          isDisabled={isLoading}
          startContent={<IoIosAddCircleOutline size={22} />}
          className="font-bold"
          onPress={() => navigate("/cars/add-job?", {
            state: {
              license
            }
          })}
        >
          Nuevo trabajo
        </Button>
      </div>

      <JobsTable
        jobs={jobs}
        isLoading={isLoading}
        noRowsLabel="No hay trabajos registrados"
      />
    </div>
  );
};

export default Jobs;
