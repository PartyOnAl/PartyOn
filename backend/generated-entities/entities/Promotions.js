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
exports.Promotions = void 0;
const typeorm_1 = require("typeorm");
const Clubs_1 = require("./Clubs");
const SavedPromotions_1 = require("./SavedPromotions");
let Promotions = class Promotions {
    promotionId;
    title;
    description;
    category;
    discountValue;
    originalPrice;
    rating;
    validFrom;
    validUntil;
    status;
    imageUrl;
    includedItems;
    createdAt;
    club;
    savedPromotions;
};
exports.Promotions = Promotions;
__decorate([
    (0, typeorm_1.Column)("uuid", {
        primary: true,
        name: "promotion_id",
        default: () => "uuid_generate_v4()",
    }),
    __metadata("design:type", String)
], Promotions.prototype, "promotionId", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { name: "title" }),
    __metadata("design:type", String)
], Promotions.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { name: "description", nullable: true }),
    __metadata("design:type", Object)
], Promotions.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { name: "category", nullable: true }),
    __metadata("design:type", Object)
], Promotions.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)("numeric", {
        name: "discount_value",
        nullable: true,
        precision: 10,
        scale: 2,
    }),
    __metadata("design:type", Object)
], Promotions.prototype, "discountValue", void 0);
__decorate([
    (0, typeorm_1.Column)("numeric", {
        name: "original_price",
        nullable: true,
        precision: 10,
        scale: 2,
    }),
    __metadata("design:type", Object)
], Promotions.prototype, "originalPrice", void 0);
__decorate([
    (0, typeorm_1.Column)("numeric", {
        name: "rating",
        nullable: true,
        precision: 10,
        scale: 2,
    }),
    __metadata("design:type", Object)
], Promotions.prototype, "rating", void 0);
__decorate([
    (0, typeorm_1.Column)("timestamp with time zone", { name: "valid_from", nullable: true }),
    __metadata("design:type", Object)
], Promotions.prototype, "validFrom", void 0);
__decorate([
    (0, typeorm_1.Column)("timestamp with time zone", { name: "valid_until", nullable: true }),
    __metadata("design:type", Object)
], Promotions.prototype, "validUntil", void 0);
__decorate([
    (0, typeorm_1.Column)("text", {
        name: "status",
        nullable: true,
        default: () => "'pending'",
    }),
    __metadata("design:type", Object)
], Promotions.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { name: "image_url", nullable: true }),
    __metadata("design:type", Object)
], Promotions.prototype, "imageUrl", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { name: "included_items", nullable: true }),
    __metadata("design:type", Object)
], Promotions.prototype, "includedItems", void 0);
__decorate([
    (0, typeorm_1.Column)("timestamp with time zone", {
        name: "created_at",
        nullable: true,
        default: () => "now()",
    }),
    __metadata("design:type", Object)
], Promotions.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Clubs_1.Clubs, (clubs) => clubs.promotions, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)([{ name: "club_id", referencedColumnName: "clubId" }]),
    __metadata("design:type", Clubs_1.Clubs)
], Promotions.prototype, "club", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => SavedPromotions_1.SavedPromotions, (savedPromotions) => savedPromotions.promotion),
    __metadata("design:type", Array)
], Promotions.prototype, "savedPromotions", void 0);
exports.Promotions = Promotions = __decorate([
    (0, typeorm_1.Index)("promotions_pkey", ["promotionId"], { unique: true }),
    (0, typeorm_1.Entity)("promotions", { schema: "public" })
], Promotions);
//# sourceMappingURL=Promotions.js.map