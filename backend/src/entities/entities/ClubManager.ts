import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Index("Club_Manager_manager_email_key", ["managerEmail"], { unique: true })
@Index("Club_Manager_pkey", ["managerId"], { unique: true })
@Index("Club_Manager_manager_phone_number_key", ["managerPhoneNumber"], {
  unique: true,
})
@Index("Club_Manager_password_key", ["password"], { unique: true })
@Entity("Club_Manager", { schema: "public" })
export class ClubManager {
  @PrimaryGeneratedColumn({ type: "integer", name: "manager_id" })
  managerId: number;

  @Column("text", { name: "manager_name" })
  managerName: string;

  @Column("text", { name: "manager_surname" })
  managerSurname: string;

  @Column("text", { name: "manager_email", nullable: true, unique: true })
  managerEmail: string | null;

  @Column("text", {
    name: "manager_phone_number",
    nullable: true,
    unique: true,
  })
  managerPhoneNumber: string | null;

  @Column("text", { name: "password", nullable: true, unique: true })
  password: string | null;
}
