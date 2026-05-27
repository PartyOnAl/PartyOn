import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { Events } from "./Events";

@Index("bookmarks_user_id_event_id_key", ["eventId", "userId"], {
  unique: true,
})
@Index("bookmarks_pkey", ["id"], { unique: true })
@Entity("bookmarks", { schema: "public" })
export class Bookmarks {
  @Column("uuid", {
    primary: true,
    name: "id",
    default: () => "uuid_generate_v4()",
  })
  id: string;

  @Column("uuid", { name: "user_id", nullable: true })
  userId: string | null;

  @Column("uuid", { name: "event_id", nullable: true })
  eventId: string | null;

  @Column("timestamp with time zone", {
    name: "created_at",
    nullable: true,
    default: () => "now()",
  })
  createdAt: Date | null;

  @ManyToOne(() => Events, (events) => events.bookmarks, {
    onDelete: "CASCADE",
  })
  @JoinColumn([{ name: "event_id", referencedColumnName: "eventId" }])
  event: Events;
}
