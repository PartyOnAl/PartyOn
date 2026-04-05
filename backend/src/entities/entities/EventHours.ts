import { Column, Entity, Index } from "typeorm";

@Index("Event_Hours_pkey", ["eventHours"], { unique: true })
@Entity("Event_Hours", { schema: "public" })
export class EventHours {
  @Column("date", { primary: true, name: "event_hours" })
  eventHours: string;
}
