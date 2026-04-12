import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from "typeorm";
import { Reservations } from "./Reservations";
import { Clubs } from "./Clubs";

@Index("tables_pkey", ["id"], { unique: true })
@Entity("tables", { schema: "public" })
export class Tables {
  @Column("uuid", {
    primary: true,
    name: "id",
    default: () => "uuid_generate_v4()",
  })
  id: string;

  @Column("text", { name: "table_number" })
  tableNumber: string;

  @Column("integer", { name: "seating_capacity" })
  seatingCapacity: number;

  @Column("numeric", {
    name: "minimum_spend",
    nullable: true,
    precision: 10,
    scale: 2,
  })
  minimumSpend: string | null;

  @Column("text", { name: "position", nullable: true })
  position: string | null;

  @Column("text", { name: "location", nullable: true })
  location: string | null;

  @Column("text", { name: "sector", nullable: true })
  sector: string | null;

  @Column("text", { name: "type", nullable: true })
  type: string | null;

  @Column("text", {
    name: "table_status",
    nullable: true,
    default: () => "'available'",
  })
  tableStatus: string | null;

  @Column("timestamp with time zone", {
    name: "created_at",
    nullable: true,
    default: () => "now()",
  })
  createdAt: Date | null;

  @OneToMany(() => Reservations, (reservations) => reservations.table)
  reservations: Reservations[];

  @ManyToOne(() => Clubs, (clubs) => clubs.tables, { onDelete: "CASCADE" })
  @JoinColumn([{ name: "club_id", referencedColumnName: "clubId" }])
  club: Clubs;
}
