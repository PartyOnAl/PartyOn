import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";
@Entity("USER", { schema: "public" })
export class User {
  @PrimaryGeneratedColumn({ type: "integer", name: "id" })
  id: number;

  @Column("text", { name: "name" })
  name: string;

  @Column("text", { name: "surname" })
  surname: string;

  @Column("text", { name: "user_name" })
  userName: string;

  @Column("text", { name: "phone_number" })
  phoneNumber: string;

  @Column("text", { name: "email" })
  email: string;

  @Column("date", { name: "birth_date" })
  birthDate: string;

  @Column("text", { name: "password" })
  password: string;
}
