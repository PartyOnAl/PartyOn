import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Index("Event_pkey", ["eventId"], { unique: true })
@Entity("Event", { schema: "public" })
export class Event {
  @PrimaryGeneratedColumn({ type: "integer", name: "event_id" })
  eventId: number;

  @Column("text", { name: "event_name" })
  eventName: string;

  @Column("text", { name: "event_description" })
  eventDescription: string;

  @Column("date", { name: "event_starting_date" })
  eventStartingDate: string;

  @Column("date", { name: "event_ending_date" })
  eventEndingDate: string;

  @Column("text", { name: "event_type" })
  eventType: string;

  @Column("character varying", { name: "eventStatus", length: 1 })
  eventStatus: string;

  @Column("numeric", {
    name: "ticketPrice",
    precision: 10,
    scale: 2,
    default: () => "'0'",
  })
  ticketPrice: string;

  @Column("numeric", {
    name: "ticketDiscount",
    precision: 10,
    scale: 2,
    default: () => "'0'",
  })
  ticketDiscount: string;

  @Column("numeric", {
    name: "finalTicketPrice",
    precision: 10,
    scale: 2,
    default: () => "'0'",
  })
  finalTicketPrice: string;

  @Column("text", { name: "event_image" })
  eventImage: string;

  @Column("integer", { name: "event_capacity", default: () => "0" })
  eventCapacity: number;
}
