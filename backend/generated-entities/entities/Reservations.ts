import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from "typeorm";
import { Entries } from "./Entries";
import { Payments } from "./Payments";
import { Events } from "./Events";
import { Tables } from "./Tables";
import { TicketTypes } from "./TicketTypes";
import { Profiles } from "./Profiles";

@Index("reservations_qr_code_key", ["qrCode"], { unique: true })
@Index("reservations_pkey", ["reservationId"], { unique: true })
@Entity("reservations", { schema: "public" })
export class Reservations {
  @Column("uuid", {
    primary: true,
    name: "reservation_id",
    default: () => "uuid_generate_v4()",
  })
  reservationId: string;

  @Column("timestamp with time zone", {
    name: "reservation_date",
    nullable: true,
    default: () => "now()",
  })
  reservationDate: Date | null;

  @Column("text", { name: "notes", nullable: true })
  notes: string | null;

  @Column("time without time zone", {
    name: "expected_arrival_time",
    nullable: true,
  })
  expectedArrivalTime: string | null;

  @Column("integer", {
    name: "nr_of_people",
    nullable: true,
    default: () => "1",
  })
  nrOfPeople: number | null;

  @Column("text", { name: "type", nullable: true, default: () => "'ticket'" })
  type: string | null;

  @Column("text", {
    name: "status",
    nullable: true,
    default: () => "'pending'",
  })
  status: string | null;

  @Column("text", {
    name: "qr_code",
    nullable: true,
    unique: true,
    default: () => "(uuid_generate_v4())::text",
  })
  qrCode: string | null;

  @Column("timestamp with time zone", {
    name: "created_at",
    nullable: true,
    default: () => "now()",
  })
  createdAt: Date | null;

  @OneToMany(() => Entries, (entries) => entries.reservation)
  entries: Entries[];

  @OneToMany(() => Payments, (payments) => payments.reservation)
  payments: Payments[];

  @ManyToOne(() => Events, (events) => events.reservations)
  @JoinColumn([{ name: "event_id", referencedColumnName: "eventId" }])
  event: Events;

  @ManyToOne(() => Tables, (tables) => tables.reservations)
  @JoinColumn([{ name: "table_id", referencedColumnName: "id" }])
  table: Tables;

  @ManyToOne(() => TicketTypes, (ticketTypes) => ticketTypes.reservations)
  @JoinColumn([{ name: "ticket_type_id", referencedColumnName: "id" }])
  ticketType: TicketTypes;

  @ManyToOne(() => Profiles, (profiles) => profiles.reservations, {
    onDelete: "CASCADE",
  })
  @JoinColumn([{ name: "user_id", referencedColumnName: "id" }])
  user: Profiles;
}
