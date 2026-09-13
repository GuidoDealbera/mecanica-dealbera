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
  ALPINE: "Alpine",
} as const;

export type CarBrand = (typeof CarsBrands)[keyof typeof CarsBrands];

export const BRANDS = Object.values(CarsBrands).sort((a, b) =>
  a.localeCompare(b)
);

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
    .split(" ")
    .map((word) => {
      if (word.length === 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
};

export const handleCapitalizedChange = (
  fieldOnChange: (value: string) => void
) => {
  return (e: React.ChangeEvent<HTMLInputElement>) => {
    const capitalizedValue = capitalizeWords(e.target.value);
    fieldOnChange(capitalizedValue);
  };
};

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "---";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "---";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * El dinero de esta aplicación son **pesos enteros**, sin centavos.
 *
 * No es una decisión que se tome acá: `job.price`, `document.total` y el número
 * de documento son columnas `integer`, y `formatARS` imprime con
 * `maximumFractionDigits: 0`. Lo único que se había escapado es el precio de
 * los repuestos, que vive en un JSON libre —eso lo arregla `JobPartDto`— y este
 * par de funciones, que son la entrada y la salida de los tres campos de dinero
 * del programa: el precio del trabajo, el de cada repuesto y la edición del
 * precio en la lista de trabajos.
 */

/** Muestra un importe con los puntos de miles: `1234567` → `1.234.567`. */
export const formatThousands = (value?: number | null) => {
  if (value === null || value === undefined) return "";
  // Se redondea antes de agrupar. Sin esto, un valor con decimales —que puede
  // haber quedado guardado en los repuestos de un trabajo viejo— se agrupaba
  // como si el punto decimal fuera un separador de miles: `1234.56` salía
  // `"1.234.56"`, y al volver a guardar se leía como 123456.
  return Math.round(value)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

/**
 * Lee lo que el usuario escribió en un campo de dinero.
 *
 * Antes borraba **todos** los puntos y llamaba a `Number`, que con la coma
 * decimal argentina da `NaN`. Las dos formas de escribir un decimal terminaban
 * mal, y ninguna avisaba:
 *
 * - `"1234,56"` → `0`: el importe se ponía en cero.
 * - `"1234.56"` → `123456`: el punto se tomaba por separador de miles y el
 *   precio quedaba **cien veces más caro**.
 *
 * Ahora se distingue cuál es cuál. La coma es siempre el separador decimal, y un
 * punto lo es sólo si es **el único** y lo siguen **una o dos cifras al final**,
 * que es como se escriben los centavos. En cualquier otro caso los puntos son
 * separadores de miles. El resultado se redondea, porque el importe se guarda en
 * pesos enteros: es preferible cobrar un peso de más o de menos que cien veces
 * de más.
 *
 * Lo de "una o dos cifras" no es un detalle de gusto, y costó una regresión.
 * Estos campos se muestran formateados con `formatThousands`, así que tipear
 * `15000` pasa por `"1.500"` y la tecla siguiente deja `"1.5000"` en el input.
 * Con la regla anterior —"punto decimal salvo que agrupe de a tres"— eso se leía
 * `1,5` y se guardaba **2 pesos**. Un precio de miles no tiene cuatro decimales;
 * uno de centavos no tiene más de dos.
 */
export const parseNumber = (value: string) => {
  const texto = value.trim();
  if (texto === "") return 0;

  // Con coma presente, los puntos son separadores de miles sin ambigüedad.
  const conComa = texto.includes(",");
  const esPuntoDecimal = !conComa && /^-?\d*\.\d{1,2}$/.test(texto);

  const normalizado = esPuntoDecimal
    ? texto
    : texto.replace(/\./g, "").replace(",", ".");

  const numero = Number(normalizado);
  return isNaN(numero) ? 0 : Math.round(numero);
};

export const formatARS = (n: number): string =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(n);

export const formatNumbers = (value: string | number) => {
  let numValue: number;
  if (typeof value === "string") {
    numValue = Number(value);
  } else {
    numValue = value;
  }
  return new Intl.NumberFormat("es-AR").format(numValue);
};

export const normalizeText = (text: string): string => {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
};

/**
 * Saca el prefijo "15" de celular que va despu\u00e9s del c\u00f3digo de \u00e1rea en un
 * n\u00famero local argentino. El n\u00famero can\u00f3nico (\u00e1rea + abonado) tiene 10 d\u00edgitos;
 * con el 15 son 12, as\u00ed que s\u00f3lo se remueve cuando el "15" aparece justo
 * despu\u00e9s de un \u00e1rea de 2, 3 o 4 d\u00edgitos y el total es 12.
 */
const stripArMobilePrefix = (local: string): string => {
  if (local.length !== 12) return local;
  for (const areaLen of [2, 3, 4]) {
    if (local.slice(areaLen, areaLen + 2) === "15") {
      return local.slice(0, areaLen) + local.slice(areaLen + 2);
    }
  }
  return local;
};

/**
 * Normaliza un tel\u00e9fono argentino al formato que espera WhatsApp (wa.me):
 * d\u00edgitos, con c\u00f3digo de pa\u00eds 54 y el 9 de celular, sin 0 inicial ni el 15.
 *
 * - Si ya viene con c\u00f3digo de pa\u00eds (54...), lo respeta y s\u00f3lo re-normaliza el
 *   9/15 del celular.
 * - Si es local (ej. 381..., 0381..., con o sin 15), saca el 0 y el 15 y
 *   antepone `54 9`.
 *
 * Es best-effort: WhatsApp muestra el contacto antes de enviar, as\u00ed que el
 * usuario confirma visualmente el n\u00famero. Devuelve "" si no hay d\u00edgitos.
 */
export const toWhatsappNumber = (phone: string | null | undefined): string => {
  let digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2); // prefijo internacional

  // Ya trae el c\u00f3digo de pa\u00eds argentino.
  if (digits.startsWith("54")) {
    let rest = digits.slice(2);
    if (rest.startsWith("9")) rest = rest.slice(1); // sacamos el 9 para re-normalizar el 15
    return `549${stripArMobilePrefix(rest)}`;
  }

  // N\u00famero local: sacar 0 inicial y el 15, anteponer 54 9.
  if (digits.startsWith("0")) digits = digits.slice(1);
  return `549${stripArMobilePrefix(digits)}`;
};

/** Arma el link de wa.me con un mensaje opcional pre-cargado. */
export const buildWhatsappUrl = (
  phone: string | null | undefined,
  message?: string
): string => {
  const number = toWhatsappNumber(phone);
  if (!number) return "";
  const base = `https://wa.me/${number}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
};
