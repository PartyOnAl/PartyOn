import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { Reservations } from "./Reservations";
import { Profiles } from "./Profiles";
import { Events } from "./Events";
import { Tables } from "./Tables";

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

  @Column("numeric", { name: "times_used", precision: 10, scale: 2 })
  timesUsed: number;

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

  @Column("text", {
    name: "batch_id",
    nullable: true,
  })
  batch_id: string | null;

  /** Stripe PaymentIntent id (`pi_...`) when Checkout completes; optional until webhook. */
  @Column("text", {
    name: "intent",
    nullable: true,
  })
  intent: string | null;

  @ManyToOne(() => Reservations, (reservations) => reservations.payments, {
    onDelete: "CASCADE",
  })
  @JoinColumn([
    { name: "reservation_id", referencedColumnName: "reservationId" },
  ])
  reservation: Reservations;

  @ManyToOne(() => Events,{
    onDelete: "CASCADE",
  })
  @JoinColumn([
    { name: "event_id", referencedColumnName: "eventId" },
  ])
  event: Events;

  @ManyToOne(() => Profiles, (profiles) => profiles.payments)
  @JoinColumn([{ name: "user_id", referencedColumnName: "id" }])
  user: Profiles;

  @ManyToOne(() => Tables, (tables) => tables.payments, {
    onDelete: "SET NULL",
  })
  @JoinColumn([{ name: "table_id", referencedColumnName: "id" }])
  table: Tables | null;
}
