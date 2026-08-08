import "reflect-metadata";
import { Column, Entity, PrimaryColumn } from "typeorm";

/**
 * Configuración de la aplicación como pares clave/valor.
 *
 * Vive en la base (y no en un archivo aparte) para que viaje con el backup: el
 * respaldo copia el `.db`, así que una configuración fuera de la base se
 * perdería al restaurar. Hoy la usan los intervalos de service.
 */
@Entity({ name: "app_setting" })
export class AppSetting {
  @PrimaryColumn("varchar")
  key!: string;

  /** Valor serializado como texto (los consumidores lo parsean). */
  @Column("text", { default: "" })
  value!: string;

  constructor(partial?: Partial<AppSetting>) {
    if (partial) Object.assign(this, partial);
  }
}
