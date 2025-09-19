import NewLicenceTable from "./NewLicenceTable";
import OldLicenceTable from "./OldLicenceTable";

interface Props {
    licence: string;
    width?: string | number
    dialog?: boolean
}

const LicenceTable: React.FC<Props> = ({licence, dialog, width}) => {
    const isNewFormat = licence.length === 7;
    return isNewFormat ? <NewLicenceTable licence={licence} width={width} dialog={dialog}/> : <OldLicenceTable licence={licence} width={width} dialog={dialog}/> 
  }
  
  export default LicenceTable