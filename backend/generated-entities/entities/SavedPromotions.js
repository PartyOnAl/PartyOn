"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SavedPromotions = void 0;
const typeorm_1 = require("typeorm");
const Promotions_1 = require("./Promotions");
let SavedPromotions = class SavedPromotions {
    id;
    userId;
    promotionId;
    createdAt;
    promotion;
};
exports.SavedPromotions = SavedPromotions;
__decorate([
    (0, typeorm_1.Column)("uuid", {
        primary: true,
        name: "id",
        default: () => "gen_random_uuid()",
    }),
    __metadata("design:type", String)
], SavedPromotions.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)("uuid", { name: "user_id", unique: true }),
    __metadata("design:type", String)
], SavedPromotions.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)("uuid", { name: "promotion_id", unique: true }),
    __metadata("design:type", String)
], SavedPromotions.prototype, "promotionId", void 0);
__decorate([
    (0, typeorm_1.Column)("timestamp with time zone", {
        name: "created_at",
        nullable: true,
        default: () => "now()",
    }),
    __metadata("design:type", Object)
], SavedPromotions.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Promotions_1.Promotions, (promotions) => promotions.savedPromotions, {
        onDelete: "CASCADE",
    }),
    (0, typeorm_1.JoinColumn)([{ name: "promotion_id", referencedColumnName: "promotionId" }]),
    __metadata("design:type", Promotions_1.Promotions)
], SavedPromotions.prototype, "promotion", void 0);
exports.SavedPromotions = SavedPromotions = __decorate([
    (0, typeorm_1.Index)("saved_promotions_pkey", ["id"], { unique: true }),
    (0, typeorm_1.Index)("saved_promotions_user_id_promotion_id_key", ["promotionId", "userId"], {
        unique: true,
    }),
    (0, typeorm_1.Entity)("saved_promotions", { schema: "public" })
], SavedPromotions);
//# sourceMappingURL=SavedPromotions.js.map