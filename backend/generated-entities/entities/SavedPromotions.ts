import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { Promotions } from "./Promotions";

@Index("saved_promotions_pkey", ["id"], { unique: true })
@Index("saved_promotions_user_id_promotion_id_key", ["promotionId", "userId"], {
  unique: true,
})
@Entity("saved_promotions", { schema: "public" })
export class SavedPromotions {
  @Column("uuid", {
    primary: true,
    name: "id",
    default: () => "gen_random_uuid()",
  })
  id: string;

  @Column("uuid", { name: "user_id", unique: true })
  userId: string;

  @Column("uuid", { name: "promotion_id", unique: true })
  promotionId: string;

  @Column("timestamp with time zone", {
    name: "created_at",
    nullable: true,
    default: () => "now()",
  })
  createdAt: Date | null;

  @ManyToOne(() => Promotions, (promotions) => promotions.savedPromotions, {
    onDelete: "CASCADE",
  })
  @JoinColumn([{ name: "promotion_id", referencedColumnName: "promotionId" }])
  promotion: Promotions;
}
