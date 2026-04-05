import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Index("Reservations_pkey", ["reservationId"], { unique: true })
@Entity("Reservations", { schema: "public" })
export class Reservations {
  @PrimaryGeneratedColumn({ type: "integer", name: "reservation_id" })
  reservationId: number;

  @Column("integer", { name: "nr_of_people", default: () => "0" })
  nrOfPeople: number;

  @Column("text", { name: "status" })
  status: string;

  @Column("text", { name: "qr_code" })
  qrCode: string;

  @Column("text", { name: "type" })
  type: string;

  @Column("date", { name: "expected_arrival_time" })
  expectedArrivalTime: string;

  @Column("text", { name: "notes", nullable: true })
  notes: string | null;
}
