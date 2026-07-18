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
  toCsv,
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

describe("toCsv", () => {
  // BOM UTF-8 sin escribir el carácter literal (dispara no-irregular-whitespace).
  const BOM = String.fromCharCode(0xfeff);

  it("genera encabezados y filas separadas por ';'", () => {
    const csv = toCsv(
      { name: "Nombre", age: "Edad" },
      [{ name: "Juan", age: 30 }],
    );
    const lines = csv.replace(BOM, "").split("\n");
    expect(lines[0]).toBe("Nombre;Edad");
    expect(lines[1]).toBe("Juan;30");
  });

  it("incluye el BOM UTF-8 al inicio", () => {
    const csv = toCsv({ name: "Nombre" }, [{ name: "Juan" }]);
    expect(csv.startsWith(BOM)).toBe(true);
  });

  it("escapa valores que contienen el separador", () => {
    const csv = toCsv({ note: "Nota" }, [{ note: "hola; chau" }]);
    expect(csv).toContain('"hola; chau"');
  });

  it("escapa comillas dobles duplicándolas", () => {
    const csv = toCsv({ note: "Nota" }, [{ note: 'dijo "hola"' }]);
    expect(csv).toContain('"dijo ""hola"""');
  });

  it("representa valores nulos como celda vacía", () => {
    const csv = toCsv({ note: "Nota" }, [{ note: null as unknown as string }]);
    const lines = csv.replace(BOM, "").split("\n");
    expect(lines[1]).toBe("");
  });
});
