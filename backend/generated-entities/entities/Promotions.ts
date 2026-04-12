import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from "typeorm";
import { Clubs } from "./Clubs";
import { SavedPromotions } from "./SavedPromotions";

@Index("promotions_pkey", ["promotionId"], { unique: true })
@Entity("promotions", { schema: "public" })
export class Promotions {
  @Column("uuid", {
    primary: true,
    name: "promotion_id",
    default: () => "uuid_generate_v4()",
  })
  promotionId: string;

  @Column("text", { name: "title" })
  title: string;

  @Column("text", { name: "description", nullable: true })
  description: string | null;

  @Column("text", { name: "category", nullable: true })
  category: string | null;

  @Column("numeric", {
    name: "discount_value",
    nullable: true,
    precision: 10,
    scale: 2,
  })
  discountValue: string | null;

  @Column("numeric", {
    name: "rating",
    nullable: true,
    precision: 10,
    scale: 2,
  })
  rating: string | null;

  @Column("timestamp with time zone", { name: "valid_from", nullable: true })
  validFrom: Date | null;

  @Column("timestamp with time zone", { name: "valid_until", nullable: true })
  validUntil: Date | null;

  @Column("text", {
    name: "status",
    nullable: true,
    default: () => "'pending'",
  })
  status: string | null;

  @Column("text", { name: "image_url", nullable: true })
  imageUrl: string | null;

  @Column("timestamp with time zone", {
    name: "created_at",
    nullable: true,
    default: () => "now()",
  })
  createdAt: Date | null;

  @ManyToOne(() => Clubs, (clubs) => clubs.promotions, { onDelete: "CASCADE" })
  @JoinColumn([{ name: "club_id", referencedColumnName: "clubId" }])
  club: Clubs;

  @OneToMany(
    () => SavedPromotions,
    (savedPromotions) => savedPromotions.promotion
  )
  savedPromotions: SavedPromotions[];
}
