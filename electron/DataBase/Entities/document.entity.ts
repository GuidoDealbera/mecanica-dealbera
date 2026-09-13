import "reflect-metadata";
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";
import { DocumentType } from "../../../src/Types/apiTypes";

/**
 * Documento emitido (presupuesto o factura). Existe para llevar la numeración
 * **correlativa** por tipo y el registro histórico de lo que se entregó.
 *
 * Los datos del vehículo/titular/total se guardan como *snapshot* (no hay FK a
 * `car`): un documento emitido debe conservar lo que decía en su momento, y no
 * puede desaparecer ni cambiar porque después se edite o se elimine el
 * vehículo — si se borrara en cascada se abrirían huecos en el correlativo.
 */
@Entity({ name: "document" })
@Index("IDX_document_type_number", ["type", "number"], { unique: true })
// El orden del historial (`createdAt DESC, number DESC`). Se crea en la
// migración `AddDocumentDateIndex`; se declara acá para que la entidad y el
// esquema no se separen, con el mismo nombre que la migración.
@Index("IDX_document_created", ["createdAt", "number"])
export class Document {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("varchar")
  type!: DocumentType;

  // Correlativo dentro del tipo. Se asigna en una transacción (MAX + 1).
  @Column("integer")
  number!: number;

  @Column("varchar", { default: "" })
  licensePlate!: string;

  @Column("varchar", { default: "" })
  clientName!: string;

  @Column("integer", { default: 0 })
  total!: number;

  @CreateDateColumn({ type: "datetime" })
  createdAt!: Date;

  constructor(partial?: Partial<Document>) {
    if (partial) Object.assign(this, partial);
  }
}
