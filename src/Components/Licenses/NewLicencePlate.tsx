import { formatLicence } from "../../Utils/utils";

interface Props {
  licence: string;
  width?: string | number;
}

const NewLicencePlate: React.FC<Props> = ({ licence, width }) => {
  return (
    <div className="relative w-fit">
      <img src="/newLicence.png" width={width ?? 250} />
      <div className="flex justify-center items-center absolute top-[25] left-[5] right-[5] bg-white h-[50]">
        <h1
          style={{
            fontFamily: "FE-FONT",
            textAlign: "center",
            fontSize: 40,
            color: "black",
          }}
        >
          {formatLicence(licence)}
        </h1>
      </div>
    </div>
  );
};

export default NewLicencePlate;
