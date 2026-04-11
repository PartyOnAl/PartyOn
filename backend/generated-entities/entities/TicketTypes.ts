import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from "typeorm";
import { Reservations } from "./Reservations";
import { Events } from "./Events";

@Index("ticket_types_pkey", ["id"], { unique: true })
@Entity("ticket_types", { schema: "public" })
export class TicketTypes {
  @Column("uuid", {
    primary: true,
    name: "id",
    default: () => "uuid_generate_v4()",
  })
  id: string;

  @Column("text", { name: "name" })
  name: string;

  @Column("text", { name: "description", nullable: true })
  description: string | null;

  @Column("numeric", { name: "price", precision: 10, scale: 2 })
  price: string;

  @Column("integer", { name: "total_quantity", default: () => "100" })
  totalQuantity: number;

  @Column("integer", {
    name: "sold_quantity",
    nullable: true,
    default: () => "0",
  })
  soldQuantity: number | null;

  @Column("timestamp with time zone", {
    name: "created_at",
    nullable: true,
    default: () => "now()",
  })
  createdAt: Date | null;

  @OneToMany(() => Reservations, (reservations) => reservations.ticketType)
  reservations: Reservations[];

  @ManyToOne(() => Events, (events) => events.ticketTypes, {
    onDelete: "CASCADE",
  })
  @JoinColumn([{ name: "event_id", referencedColumnName: "eventId" }])
  event: Events;
}
