import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Index("Promotions_pkey", ["promotionId"], { unique: true })
@Entity("Promotions", { schema: "public" })
export class Promotions {
  @PrimaryGeneratedColumn({ type: "integer", name: "promotion_id" })
  promotionId: number;

  @Column("text", { name: "promotion_title" })
  promotionTitle: string;

  @Column("text", { name: "promotion_description" })
  promotionDescription: string;

  @Column("text", { name: "promotion_category" })
  promotionCategory: string;

  @Column("real", {
    name: "discount_value",
    precision: 24,
    default: () => "'0'",
  })
  discountValue: number;

  @Column("date", { name: "valid_from" })
  validFrom: string;

  @Column("date", { name: "valid_until" })
  validUntil: string;

  @Column("text", { name: "promotion_status" })
  promotionStatus: string;
}
