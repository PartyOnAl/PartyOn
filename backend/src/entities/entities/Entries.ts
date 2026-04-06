import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Index("Entries_pkey", ["entryId"], { unique: true })
@Entity("Entries", { schema: "public" })
export class Entries {
  @PrimaryGeneratedColumn({ type: "integer", name: "entry_id" })
  entryId: number;

  @Column("date", { name: "entry_time" })
  entryTime: string;

  @Column("text", { name: "entry_type" })
  entryType: string;

  @Column("text", { name: "entry_notes", nullable: true })
  entryNotes: string | null;
}
