import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Index("Event_pkey", ["eventId"], { unique: true })
@Entity("events", { schema: "public" })
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

  @Column("varchar", { length: 1 })
  eventStatus: string;

  @Column("numeric", { precision: 10, scale: 2, default: 0 })
  ticketPrice: number;

  @Column("numeric", { precision: 10, scale: 2, default: 0 })
  ticketDiscount: number;

  @Column("numeric", { precision: 10, scale: 2, default: 0 })
  finalTicketPrice: number;

  @Column("text", { name: "event_image" })
  eventImage: string;

  @Column("integer", { name: "event_capacity", default: () => "0" })
  eventCapacity: number;
}
