import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Index("Super_Admin_pkey", ["adminId"], { unique: true })
@Entity("Super_Admin", { schema: "public" })
export class SuperAdmin {
  @PrimaryGeneratedColumn({ type: "integer", name: "admin_id" })
  adminId: number;

  @Column("text", { name: "admin_name" })
  adminName: string;

  @Column("text", { name: "admin_surname" })
  adminSurname: string;

  @Column("text", { name: "admin_phone" })
  adminPhone: string;

  @Column("text", { name: "admin_email" })
  adminEmail: string;

  @Column("text", { name: "admin_password" })
  adminPassword: string;
}
