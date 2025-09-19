import { formatLicence } from "../../Utils/utils";

interface NewLicenceTableProps {
  licence: string;
  width?: string | number;
  dialog?: boolean;
}

const NewLicenceTable: React.FC<NewLicenceTableProps> = ({
  licence,
  width,
  dialog,
}) => {
  return (
    <div
      style={{
        position: "relative",
        width: "fit-content",
        marginTop: dialog ? 0 : 2.5,
      }}
    >
      <img src="/newLicence.png" width={width ?? 130} style={{minWidth: 110, maxWidth: 130, height: 50}} />
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'absolute',
        backgroundColor: 'white',
        top: 15,
        left: 2,
        right: 2,
        bottom: 2,
        borderRadius: 2,
      }}>
        <h1
          style={{
            fontFamily: "FE-FONT",
            textAlign: "center",
            fontSize: 22,
            color: "black",
          }}
        >
          {formatLicence(licence)}
        </h1>
      </div>
    </div>
  );
};

export default NewLicenceTable;
