import { Clubs } from "./Clubs";
import { SavedPromotions } from "./SavedPromotions";
export declare class Promotions {
    promotionId: string;
    title: string;
    description: string | null;
    category: string | null;
    discountValue: string | null;
    originalPrice: string | null;
    rating: string | null;
    validFrom: Date | null;
    validUntil: Date | null;
    status: string | null;
    imageUrl: string | null;
    includedItems: string | null;
    createdAt: Date | null;
    club: Clubs;
    savedPromotions: SavedPromotions[];
}
