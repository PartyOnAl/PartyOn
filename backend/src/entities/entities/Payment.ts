import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Index("Payment_pkey", ["paymentId"], { unique: true })
@Entity("Payment", { schema: "public" })
export class Payment {
  @PrimaryGeneratedColumn({ type: "integer", name: "payment_id" })
  paymentId: number;

  @Column("real", {
    name: "payment_ammount",
    precision: 24,
    default: () => "'0'",
  })
  paymentAmmount: number;

  @Column("date", { name: "payment_date" })
  paymentDate: string;

  @Column("text", { name: "payment_status" })
  paymentStatus: string;
}
