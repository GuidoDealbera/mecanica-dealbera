import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { applyRetention, listBackups, listRestorable } from "./backups";

/**
 * Qué respaldos se le ofrecen al usuario y cuáles borra la poda.
 *
 * La pantalla usaba `listBackups`, que reconoce sólo `taller_<AAAA-MM-DD>.db`.
 * El nombre que propone la exportación manual es `taller_backup_<fecha>.db`,
 * que no matchea: si el usuario lo guardaba en la carpeta de respaldos
 * esperando verlo ahí, **no aparecía**.
 *
 * La forma fácil de arreglarlo —hacer que `listBackups` acepte más nombres—
 * tiene una trampa: de esa misma lista sale lo que `applyRetention` **borra**.
 * Los respaldos que el usuario guardó a mano se los habría llevado la poda
 * diaria, que es exactamente lo contrario de lo que espera quien guarda una
 * copia. Por eso son dos listas, y hay un caso que lo fija.
 */

let dir: string;

const crear = (nombre: string, cuando?: Date) => {
  const ruta = path.join(dir, nombre);
  fs.writeFileSync(ruta, "una base");
  if (cuando) fs.utimesSync(ruta, cuando, cuando);
  return ruta;
};

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "mecanica-resp2-"));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("lo que se le ofrece restaurar", () => {
  it("incluye el respaldo exportado a mano", () => {
    crear("taller_2026-09-06.db");
    crear("taller_backup_2026-09-08.db");

    const nombres = listRestorable(dir).map((b) => b.name);

    expect(nombres).toContain("taller_backup_2026-09-08.db");
    expect(nombres).toContain("taller_2026-09-06.db");
  });

  it("dice de dónde salió cada uno", () => {
    // No significan lo mismo: el automático se rota solo, el manual lo guardó
    // el usuario y el previo lo dejó una actualización.
    crear("taller_2026-09-06.db");
    crear("mi_copia_antes_de_tocar.db");
    crear("pre-migration_2.0.0_2026-09-06_1432.db");

    const porNombre = Object.fromEntries(
      listRestorable(dir).map((b) => [b.name, b.origin])
    );

    expect(porNombre["taller_2026-09-06.db"]).toBe("automatico");
    expect(porNombre["mi_copia_antes_de_tocar.db"]).toBe("manual");
    expect(porNombre["pre-migration_2.0.0_2026-09-06_1432.db"]).toBe("previo");
  });

  it("usa la fecha del archivo y no la del nombre", () => {
    // La del nombre no existe para los manuales, y para los automáticos puede
    // mentir: alcanza con renombrar un archivo.
    const cuando = new Date(2026, 4, 20, 15, 30);
    crear("taller_2026-01-01.db", cuando);

    const [respaldo] = listRestorable(dir);

    expect(respaldo.date.getFullYear()).toBe(2026);
    expect(respaldo.date.getMonth()).toBe(4);
    expect(respaldo.date.getDate()).toBe(20);
  });

  it("ignora lo que no es una base", () => {
    crear("taller_2026-09-06.db");
    crear("notas.txt");

    expect(listRestorable(dir).map((b) => b.name)).toEqual([
      "taller_2026-09-06.db",
    ]);
  });
});

describe("la poda de respaldos", () => {
  it("no toca los que el usuario guardó a mano", () => {
    // La trampa de arreglar esto en `listBackups`: la poda diaria se habría
    // llevado los respaldos manuales.
    for (let i = 1; i <= 20; i++) {
      crear(`taller_2026-09-${String(i).padStart(2, "0")}.db`);
    }
    crear("taller_backup_2026-09-08.db");
    crear("mi_copia.db");
    crear("pre-migration_2.0.0_2026-09-06_1432.db");

    const borrados = applyRetention(dir);

    // Algo borró: si no, este caso no probaría nada.
    expect(borrados.length).toBeGreaterThan(0);
    expect(fs.existsSync(path.join(dir, "taller_backup_2026-09-08.db"))).toBe(
      true
    );
    expect(fs.existsSync(path.join(dir, "mi_copia.db"))).toBe(true);
    expect(
      fs.existsSync(path.join(dir, "pre-migration_2.0.0_2026-09-06_1432.db"))
    ).toBe(true);
  });

  it("la lista que usa la poda sigue siendo sólo la de los automáticos", () => {
    crear("taller_2026-09-06.db");
    crear("taller_backup_2026-09-08.db");
    crear("mi_copia.db");

    expect(listBackups(dir).map((b) => b.name)).toEqual([
      "taller_2026-09-06.db",
    ]);
  });
});
