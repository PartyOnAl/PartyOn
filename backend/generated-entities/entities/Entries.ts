import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { Reservations } from "./Reservations";
import { Profiles } from "./Profiles";

@Index("entries_pkey", ["entryId"], { unique: true })
@Entity("entries", { schema: "public" })
export class Entries {
  @Column("uuid", {
    primary: true,
    name: "entry_id",
    default: () => "uuid_generate_v4()",
  })
  entryId: string;

  @Column("timestamp with time zone", {
    name: "entry_time",
    nullable: true,
    default: () => "now()",
  })
  entryTime: Date | null;

  @Column("text", { name: "entry_type", nullable: true })
  entryType: string | null;

  @Column("text", { name: "notes", nullable: true })
  notes: string | null;

  @ManyToOne(() => Reservations, (reservations) => reservations.entries)
  @JoinColumn([
    { name: "reservation_id", referencedColumnName: "reservationId" },
  ])
  reservation: Reservations;

  @ManyToOne(() => Profiles, (profiles) => profiles.entries)
  @JoinColumn([{ name: "staff_id", referencedColumnName: "id" }])
  staff: Profiles;
}
