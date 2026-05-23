import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from "typeorm";
import { Profiles } from "./Profiles";
import { Events } from "./Events";
import { Promotions } from "./Promotions";
import { Tables } from "./Tables";
import { ClubPhotos } from "./ClubPhotos";

@Index("clubs_pkey", ["clubId"], { unique: true })
@Entity("clubs", { schema: "public" })
export class Clubs {
  @Column("uuid", {
    primary: true,
    name: "club_id",
    default: () => "uuid_generate_v4()",
  })
  clubId: string;

  @Column("text", { name: "club_name" })
  clubName: string;

  @Column("text", { name: "club_address", nullable: true })
  clubAddress: string | null;

  @Column("text", { name: "club_email_id", nullable: true })
  clubEmailId: string | null;

  @Column("text", { name: "club_phone_number", nullable: true })
  clubPhoneNumber: string | null;

  @Column("text", { name: "club_image", nullable: true })
  clubImage: string | null;

  @Column("text", {
    name: "club_status",
    nullable: true,
    default: () => "'pending'",
  })
  clubStatus: string | null;

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

  @Column("boolean", { name: "reservation_only", default: () => "false" })
  reservationOnly: boolean;

  @Column("numeric", {
    name: "latitude",
    nullable: true,
    precision: 10,
    scale: 8,
  })
  latitude: string | null;

  @Column("numeric", {
    name: "longitude",
    nullable: true,
    precision: 11,
    scale: 8,
  })
  longitude: string | null;

  @Column("text", { name: "club_description", nullable: true })
  clubDescription: string | null;

  @Column("double precision", {
    name: "club_lat",
    nullable: true,
    precision: 53,
  })
  clubLat: number | null;

  @Column("double precision", {
    name: "club_lng",
    nullable: true,
    precision: 53,
  })
  clubLng: number | null;

  @ManyToOne(() => Profiles, (profiles) => profiles.clubs)
  @JoinColumn([{ name: "manager_id", referencedColumnName: "id" }])
  manager: Profiles;

  @OneToMany(() => Events, (events) => events.club)
  events: Events[];

  @OneToMany(() => Promotions, (promotions) => promotions.club)
  promotions: Promotions[];

  @OneToMany(() => Tables, (tables) => tables.club)
  tables: Tables[];

  @OneToMany(() => ClubPhotos, (photo) => photo.club)
  photos?: ClubPhotos[];
}
