import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from "typeorm";
import { Bookmarks } from "./Bookmarks";
import { Clubs } from "./Clubs";
import { Profiles } from "./Profiles";
import { Reservations } from "./Reservations";
import { TicketTypes } from "./TicketTypes";

@Index("events_pkey", ["eventId"], { unique: true })
@Entity("events", { schema: "public" })
export class Events {
  @Column("uuid", {
    primary: true,
    name: "event_id",
    default: () => "uuid_generate_v4()",
  })
  eventId: string;

  @Column("text", { name: "event_name" })
  eventName: string;

  @Column("text", { name: "event_description", nullable: true })
  eventDescription: string | null;

  @Column("text", { name: "event_type", nullable: true })
  eventType: string | null;

  @Column("text", { name: "event_hours", nullable: true })
  eventHours: string | null;

  @Column("timestamp with time zone", { name: "event_starting_date" })
  eventStartingDate: Date;

  @Column("timestamp with time zone", {
    name: "event_ending_date",
    nullable: true,
  })
  eventEndingDate: Date | null;

  @Column("integer", { name: "event_capacity", nullable: true })
  eventCapacity: number | null;

  @Column("text", { name: "event_image", nullable: true })
  eventImage: string | null;

  @Column("text", {
    name: "event_status",
    nullable: true,
    default: () => "'draft'",
  })
  eventStatus: string | null;

  @Column("boolean", {
    name: "is_featured",
    nullable: true,
    default: () => "false",
  })
  isFeatured: boolean | null;

  @Column("numeric", {
    name: "final_ticket_price",
    nullable: true,
    precision: 10,
    scale: 2,
  })
  finalTicketPrice: string | null;

  @Column("numeric", {
    name: "ticket_price",
    nullable: true,
    precision: 10,
    scale: 2,
  })
  ticketPrice: string | null;

  @Column("numeric", {
    name: "ticket_discount",
    nullable: true,
    precision: 5,
    scale: 2,
    default: () => "0",
  })
  ticketDiscount: string | null;

  @Column("text", { name: "special_guests", nullable: true })
  specialGuests: string | null;

  @Column("timestamp with time zone", {
    name: "created_at",
    nullable: true,
    default: () => "now()",
  })
  createdAt: Date | null;

  @Column("timestamp with time zone", {
    name: "updated_at",
    nullable: true,
    default: () => "now()",
  })
  updatedAt: Date | null;

  @Column("text", {
    name: "featured_request_status",
    nullable: true,
    default: () => "'none'",
  })
  featuredRequestStatus: string | null;

  @Column("boolean", { name: "reservation_only", default: () => "false" })
  reservationOnly: boolean;

  @OneToMany(() => Bookmarks, (bookmarks) => bookmarks.event)
  bookmarks: Bookmarks[];

  @ManyToOne(() => Clubs, (clubs) => clubs.events, { onDelete: "CASCADE" })
  @JoinColumn([{ name: "club_id", referencedColumnName: "clubId" }])
  club: Clubs;

  @ManyToOne(() => Profiles, (profiles) => profiles.events)
  @JoinColumn([{ name: "created_by", referencedColumnName: "id" }])
  createdBy: Profiles;

  @OneToMany(() => Reservations, (reservations) => reservations.event)
  reservations: Reservations[];

  @OneToMany(() => TicketTypes, (ticketTypes) => ticketTypes.event)
  ticketTypes: TicketTypes[];
}
