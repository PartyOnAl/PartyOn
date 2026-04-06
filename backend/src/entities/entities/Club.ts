import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Index("Club_club_email_key", ["clubEmail"], { unique: true })
@Index("Club_pkey", ["clubId"], { unique: true })
@Entity("Club", { schema: "public" })
export class Club {
  @PrimaryGeneratedColumn({ type: "integer", name: "club_id" })
  clubId: number;

  @Column("text", { name: "club_name" })
  clubName: string;

  @Column("character", { name: "club_status", length: 1 })
  clubStatus: string;

  @Column("text", { name: "club_phone_number" })
  clubPhoneNumber: string;

  @Column("text", { name: "club_email", nullable: true, unique: true })
  clubEmail: string | null;

  @Column("text", { name: "club_address" })
  clubAddress: string;

  @Column("text", { name: "club_image" })
  clubImage: string;
}
