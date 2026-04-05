import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Index("Table_pkey", ["tableId"], { unique: true })
@Index("Table_table_number_key", ["tableNumber"], { unique: true })
@Entity("Table", { schema: "public" })
export class Table {
  @PrimaryGeneratedColumn({ type: "integer", name: "table_id" })
  tableId: number;

  @Column("integer", { name: "seating_capacity", default: () => "0" })
  seatingCapacity: number;

  @Column("text", { name: "position", nullable: true })
  position: string | null;

  @Column("text", { name: "sector", nullable: true })
  sector: string | null;

  @Column("text", { name: "type" })
  type: string;

  @Column("integer", {
    name: "table_number",
    nullable: true,
    unique: true,
    default: () => "0",
  })
  tableNumber: number | null;

  @Column("text", { name: "table_status" })
  tableStatus: string;

  @Column("real", {
    name: "minimum_spend",
    precision: 24,
    default: () => "'0'",
  })
  minimumSpend: number;
}
