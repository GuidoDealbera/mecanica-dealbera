import { describe, it, expect } from "vitest";
import {
  formatLicence,
  capitalizeWords,
  formatDate,
  formatThousands,
  parseNumber,
  formatARS,
  formatNumbers,
  normalizeText,
  toWhatsappNumber,
  buildWhatsappUrl,
} from "./utils";

describe("formatLicence", () => {
  it("formatea patente vieja de 6 caracteres (AAA000 -> AAA 000)", () => {
    expect(formatLicence("ABC123")).toBe("ABC 123");
  });

  it("formatea patente nueva de 7 caracteres (AA000AA -> AA 000 AA)", () => {
    expect(formatLicence("AB123CD")).toBe("AB 123 CD");
  });

  it("pasa a mayúsculas", () => {
    expect(formatLicence("ab123cd")).toBe("AB 123 CD");
  });
});

describe("capitalizeWords", () => {
  it("capitaliza cada palabra", () => {
    expect(capitalizeWords("juan perez")).toBe("Juan Perez");
  });

  it("normaliza mayúsculas de entrada", () => {
    expect(capitalizeWords("JUAN PEREZ")).toBe("Juan Perez");
  });

  it("maneja string vacío", () => {
    expect(capitalizeWords("")).toBe("");
  });

  it("no rompe con espacios múltiples", () => {
    expect(capitalizeWords("juan  perez")).toBe("Juan  Perez");
  });
});

describe("formatDate", () => {
  it("devuelve '---' para null/undefined", () => {
    expect(formatDate(null)).toBe("---");
    expect(formatDate(undefined)).toBe("---");
  });

  it("devuelve '---' para fecha inválida", () => {
    expect(formatDate("no-es-fecha")).toBe("---");
  });

  it("formatea un objeto Date como dd/mm/yyyy", () => {
    // Mes 0-indexado: 5 = junio
    expect(formatDate(new Date(2024, 5, 9))).toBe("09/06/2024");
  });

  it("rellena con ceros día y mes", () => {
    expect(formatDate(new Date(2024, 0, 1))).toBe("01/01/2024");
  });
});

describe("formatThousands", () => {
  it("agrupa miles con puntos", () => {
    expect(formatThousands(1234567)).toBe("1.234.567");
  });

  it("no agrega separador a números menores de mil", () => {
    expect(formatThousands(999)).toBe("999");
  });

  it("devuelve '' para null/undefined", () => {
    expect(formatThousands(null)).toBe("");
    expect(formatThousands(undefined)).toBe("");
  });

  it("redondea antes de agrupar", () => {
    // Un decimal guardado en un repuesto viejo se agrupaba como si el punto
    // fuera separador de miles —`1234.56` salía `"1.234.56"`—, y al volver a
    // guardar el campo eso se leía como 123456.
    expect(formatThousands(1234.56)).toBe("1.235");
    expect(formatThousands(1234567.5)).toBe("1.234.568");
  });
});

describe("parseNumber", () => {
  it("quita puntos de miles y devuelve número", () => {
    expect(parseNumber("1.234.567")).toBe(1234567);
  });

  it("devuelve 0 ante valores no numéricos", () => {
    expect(parseNumber("abc")).toBe(0);
  });

  it("es la operación inversa de formatThousands", () => {
    expect(parseNumber(formatThousands(45000))).toBe(45000);
  });

  it("entiende la coma decimal en vez de poner el importe en cero", () => {
    // Escribir "1234,56" dejaba el precio en 0, sin avisar: `Number` con coma
    // devuelve NaN y la función lo cambiaba por cero.
    expect(parseNumber("1234,56")).toBe(1235);
    expect(parseNumber("1.234,56")).toBe(1235);
    expect(parseNumber("1.234,49")).toBe(1234);
  });

  it("no toma el punto decimal por separador de miles", () => {
    // Este era el peor: "1234.56" se leía 123456, o sea **cien veces** el
    // precio. Un repuesto de mil doscientos pesos salía a ciento veintitrés mil.
    expect(parseNumber("1234.56")).toBe(1235);
    expect(parseNumber("0.5")).toBe(1);
    expect(parseNumber("12.5")).toBe(13);
  });

  it("sigue tratando el punto como miles cuando agrupa de a tres", () => {
    // Que es como lo escribe `formatThousands` y como lo escribe la gente.
    expect(parseNumber("1.234")).toBe(1234);
    expect(parseNumber("12.345")).toBe(12345);
    expect(parseNumber("1.234.567")).toBe(1234567);
  });

  it("sobrevive a que se lo tipee dígito por dígito", () => {
    // El caso que faltaba, y que costó una regresión: estos campos se muestran
    // formateados, así que escribir 150000 pasa por "1.500" y la tecla
    // siguiente deja "1.5000" en el input. Con la regla anterior eso se leía
    // 1,5 y se guardaban **2 pesos**.
    let valor = 0;
    for (const tecla of "150000") {
      valor = parseNumber(formatThousands(valor) + tecla);
    }

    expect(valor).toBe(150000);
  });

  it("un punto con más de dos cifras detrás es separador de miles", () => {
    // Un precio de miles no tiene cuatro decimales; uno de centavos no tiene
    // más de dos. Esa es la línea.
    expect(parseNumber("1.5000")).toBe(15000);
    expect(parseNumber("12.3456")).toBe(123456);
  });

  it("devuelve 0 ante un campo vacío", () => {
    expect(parseNumber("")).toBe(0);
    expect(parseNumber("   ")).toBe(0);
  });
});

describe("formatARS", () => {
  it("formatea como moneda argentina sin decimales", () => {
    // Se comparan solo los dígitos/estructura porque el símbolo y separadores
    // dependen del ICU; se valida presencia de '$' y agrupación de miles.
    const result = formatARS(1500);
    expect(result).toContain("$");
    expect(result).toContain("1.500");
  });

  it("no incluye decimales", () => {
    expect(formatARS(1500.75)).not.toContain(",75");
  });
});

describe("formatNumbers", () => {
  it("formatea números con separador de miles es-AR", () => {
    expect(formatNumbers(1234567)).toBe("1.234.567");
  });

  it("acepta strings numéricos", () => {
    expect(formatNumbers("1000")).toBe("1.000");
  });
});

describe("normalizeText", () => {
  it("quita acentos y pasa a minúsculas", () => {
    expect(normalizeText("Álvarez")).toBe("alvarez");
  });

  it("permite matching insensible a acentos", () => {
    expect(normalizeText("MARÍA").includes(normalizeText("mari"))).toBe(true);
  });
});

describe("toWhatsappNumber", () => {
  it("normaliza un celular local de Tucumán (381) a 54 9 + número", () => {
    expect(toWhatsappNumber("3814556677")).toBe("5493814556677");
  });

  it("saca el 0 inicial", () => {
    expect(toWhatsappNumber("03814556677")).toBe("5493814556677");
  });

  it("saca el 0 y el 15 (área de 3 dígitos)", () => {
    expect(toWhatsappNumber("0381154556677")).toBe("5493814556677");
  });

  it("ignora espacios, guiones y paréntesis", () => {
    expect(toWhatsappNumber("(0381) 15-455 6677")).toBe("5493814556677");
  });

  it("maneja el 15 de un número de Buenos Aires (área de 2 dígitos)", () => {
    expect(toWhatsappNumber("011 15 2345-6789")).toBe("5491123456789");
  });

  it("respeta un número que ya trae 54 9", () => {
    expect(toWhatsappNumber("+54 9 381 455 6677")).toBe("5493814556677");
  });

  it("agrega el 9 de celular si viene 54 sin el 9", () => {
    expect(toWhatsappNumber("+54 381 455 6677")).toBe("5493814556677");
  });

  it("saca el prefijo internacional 00", () => {
    expect(toWhatsappNumber("0054 9 381 455 6677")).toBe("5493814556677");
  });

  it("devuelve '' para vacío o sin dígitos", () => {
    expect(toWhatsappNumber("")).toBe("");
    expect(toWhatsappNumber(null)).toBe("");
    expect(toWhatsappNumber("abc")).toBe("");
  });
});

describe("buildWhatsappUrl", () => {
  it("arma el link wa.me con el número normalizado", () => {
    expect(buildWhatsappUrl("3814556677")).toBe("https://wa.me/5493814556677");
  });

  it("agrega el mensaje pre-cargado codificado", () => {
    expect(buildWhatsappUrl("3814556677", "a b")).toBe(
      "https://wa.me/5493814556677?text=a%20b"
    );
  });

  it("devuelve '' si no hay teléfono válido", () => {
    expect(buildWhatsappUrl("")).toBe("");
    expect(buildWhatsappUrl(null)).toBe("");
  });
});
