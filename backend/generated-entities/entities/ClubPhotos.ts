import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Clubs } from "./Clubs";

@Entity("club_photos", { schema: "public" })
export class ClubPhotos {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  id: string;

  @Column("uuid", { name: "club_id" })
  clubId: string;

  @Column("text", { name: "photo_url" })
  photoUrl: string;

  @Column("integer", { name: "sort_order", default: () => "0" })
  sortOrder: number;

  @Column("boolean", { name: "is_primary", default: () => "false" })
  isPrimary: boolean;

  @Column("timestamp with time zone", {
    name: "created_at",
    nullable: true,
    default: () => "now()",
  })
  createdAt: Date | null;

  @ManyToOne(() => Clubs, (clubs) => clubs.photos)
  @JoinColumn([{ name: "club_id", referencedColumnName: "clubId" }])
  club: Clubs;
}
