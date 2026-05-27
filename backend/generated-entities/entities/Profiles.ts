import { Column, Entity, Index, OneToMany } from "typeorm";
import { Clubs } from "./Clubs";
import { Entries } from "./Entries";
import { Events } from "./Events";
import { Payments } from "./Payments";
import { Reservations } from "./Reservations";

@Index("profiles_pkey", ["id"], { unique: true })
@Index("profiles_username_key", ["username"], { unique: true })
@Entity("profiles", { schema: "public" })
export class Profiles {
  @Column("uuid", { primary: true, name: "id" })
  id: string;

  @Column("text", { name: "name", nullable: true })
  name: string | null;

  @Column("text", { name: "surname", nullable: true })
  surname: string | null;

  @Column("text", { name: "username", nullable: true, unique: true })
  username: string | null;

  @Column("text", { name: "email", nullable: true })
  email: string | null;

  @Column("date", { name: "birth_date", nullable: true })
  birthDate: string | null;

  @Column("text", { name: "phone_number", nullable: true })
  phoneNumber: string | null;

  @Column("text", { name: "role", default: () => "'user'" })
  role: string;

  @Column("uuid", { name: "club_id", nullable: true })
  clubId: string | null;

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

  @OneToMany(() => Clubs, (clubs) => clubs.manager)
  clubs: Clubs[];

  @OneToMany(() => Entries, (entries) => entries.staff)
  entries: Entries[];

  @OneToMany(() => Events, (events) => events.createdBy)
  events: Events[];

  @OneToMany(() => Payments, (payments) => payments.user)
  payments: Payments[];

  @OneToMany(() => Reservations, (reservations) => reservations.user)
  reservations: Reservations[];
}
