import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { Reservations } from "./Reservations";
import { Profiles } from "./Profiles";
import { Events } from "./Events";

@Index("payments_pkey", ["paymentId"], { unique: true })
@Entity("payments", { schema: "public" })
export class Payments {
  @Column("uuid", {
    primary: true,
    name: "payment_id",
    default: () => "uuid_generate_v4()",
  })
  paymentId: string;

  @Column("numeric", { name: "amount", precision: 10, scale: 2 })
  amount: string;

  @Column("timestamp with time zone", {
    name: "payment_date",
    nullable: true,
    default: () => "now()",
  })
  paymentDate: Date | null;

  @Column("text", {
    name: "status",
    nullable: true,
    default: () => "'pending'",
  })
  status: string | null;

  @Column("integer", {
    name: "times_used",
    nullable: true,
    default: () => "0",
  })
  timesUsed: number | null;

  @Column("text", { name: "intent", nullable: true })
  intent: string | null;

  @Column("uuid", { name: "batch_id", nullable: true })
  batchId: string | null;

  @ManyToOne(() => Reservations, (reservations) => reservations.payments, {
    onDelete: "CASCADE",
  })
  @JoinColumn([
    { name: "reservation_id", referencedColumnName: "reservationId" },
  ])
  reservation: Reservations;

  @ManyToOne(() => Profiles, (profiles) => profiles.payments)
  @JoinColumn([{ name: "user_id", referencedColumnName: "id" }])
  user: Profiles;

  @ManyToOne(() => Events)
  @JoinColumn([{ name: "event_id", referencedColumnName: "eventId" }])
  event: Events;
}
