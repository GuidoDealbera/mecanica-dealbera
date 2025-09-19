let byPassNavigation = false;
export const setByPassNavigation = (value: boolean) =>
  (byPassNavigation = value);
export const getByPassNavigation = () => byPassNavigation;
export const CarsBrands = {
  TOYOTA: "Toyota",
  FORD: "Ford", 
  CHEVROLET: "Chevrolet",
  VOLKSWAGEN: "Volkswagen",
  RENAULT: "Renault",
  PEUGEOT: "Peugeot",
  FIAT: "Fiat",
  HONDA: "Honda",
  NISSAN: "Nissan",
  HYUNDAI: "Hyundai",
  KIA: "Kia",
  JEEP: "Jeep",
  RAM: "Ram",
  CITROEN: "Citroën",
  MERCEDES_BENZ: "Mercedes-Benz",
  BMW: "BMW",
  AUDI: "Audi",
  PORSCHE: "Porsche",
  FERRARI: "Ferrari",
  LAMBORGHINI: "Lamborghini",
  MASERATI: "Maserati",
  BENTLEY: "Bentley",
  ROLLS_ROYCE: "Rolls-Royce",
  ASTON_MARTIN: "Aston Martin",
  JAGUAR: "Jaguar",
  LAND_ROVER: "Land Rover",
  VOLVO: "Volvo",
  LEXUS: "Lexus",
  INFINITI: "Infiniti",
  ACURA: "Acura",
  CADILLAC: "Cadillac",
  LINCOLN: "Lincoln",
  MAZDA: "Mazda",
  MITSUBISHI: "Mitsubishi",
  SUZUKI: "Suzuki",
  SUBARU: "Subaru",
  ISUZU: "Isuzu",
  SSANGYONG: "SsangYong",
  CHERY: "Chery",
  JAC: "JAC",
  GEELY: "Geely",
  GREAT_WALL: "Great Wall",
  HAVAL: "Haval",
  LIFAN: "Lifan",
  DONGFENG: "Dongfeng",
  FOTON: "Foton",
  JMC: "JMC",
  CHANGAN: "Changan",
  BYD: "BYD",
  MG: "MG",
  ALFA_ROMEO: "Alfa Romeo",
  LANCIA: "Lancia",
  SEAT: "Seat",
  SKODA: "Skoda",
  OPEL: "Opel",
  SAAB: "Saab",
  SATURN: "Saturn",
  PONTIAC: "Pontiac",
  OLDSMOBILE: "Oldsmobile",
  MERCURY: "Mercury",
  PLYMOUTH: "Plymouth",
  DODGE: "Dodge",
  CHRYSLER: "Chrysler",
  HUMMER: "Hummer",
  DAEWOO: "Daewoo",
  DAIHATSU: "Daihatsu",
  IVECO: "Iveco",
  SCANIA: "Scania",
  VOLVO_TRUCKS: "Volvo Trucks",
  MERCEDES_BENZ_TRUCKS: "Mercedes-Benz Trucks",
  MAN: "MAN",
  DAF: "DAF",
  FREIGHTLINER: "Freightliner",
  KENWORTH: "Kenworth",
  PETERBILT: "Peterbilt",
  INTERNATIONAL: "International",
  IKA: "IKA",
  SIAM: "Siam",
  DINARG: "Dinarg",
  AUTOAR: "Autoar",
  RASTROJERO: "Rastrojero",
  DACIA: "Dacia",
  LADA: "Lada",
  TATA: "Tata",
  MAHINDRA: "Mahindra",
  PROTON: "Proton",
  PERODUA: "Perodua",
  MCLAREN: "McLaren",
  KOENIGSEGG: "Koenigsegg",
  BUGATTI: "Bugatti",
  PAGANI: "Pagani",
  TESLA: "Tesla",
  RIVIAN: "Rivian",
  LUCID: "Lucid",
  NIO: "NIO",
  XPENG: "XPeng",
  LI_AUTO: "Li Auto",
  FISKER: "Fisker",
  MINI: "MINI",
  SMART: "Smart",
  MAYBACH: "Maybach",
  DS: "DS",
  GENESIS: "Genesis",
  ALPINE: "Alpine"
} as const;

export type CarBrand = (typeof CarsBrands)[keyof typeof CarsBrands];

export const BRANDS = Object.values(CarsBrands)
  .sort((a, b) => a.localeCompare(b));

export const BRANDS_OPTIONS = BRANDS.map((brand) => ({
  key: brand, // clave única
  label: brand, // lo que se muestra
}));

export const formatLicence = (licencePlate: string): string => {
  const licence = licencePlate.toUpperCase();
  if (licence.length === 7) {
    return `${licence.slice(0, 2)} ${licence.slice(2, 5)} ${licence.slice(5)}`;
  }
  return `${licence.slice(0, 3)} ${licence.slice(3)}`;
};

export const capitalizeWords = (text: string): string => {
  return text
    .toLowerCase()
    .split(' ')
    .map(word => {
      if (word.length === 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
};

export const handleCapitalizedChange = (fieldOnChange: (value: string) => void) => {
  return (e: React.ChangeEvent<HTMLInputElement>) => {
    const capitalizedValue = capitalizeWords(e.target.value);
    fieldOnChange(capitalizedValue);
  };
};

export function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0"); // los meses arrancan en 0
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}
