import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Index("Door_Staff_pkey", ["id"], { unique: true })
@Entity("Door_Staff", { schema: "public" })
export class DoorStaff {
  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("text", { name: "name" })
  name: string;

  @Column("text", { name: "surname" })
  surname: string;

  @Column("text", { name: "email" })
  email: string;

  @Column("text", { name: "phone_number" })
  phoneNumber: string;

  @Column("text", { name: "password" })
  password: string;
}
