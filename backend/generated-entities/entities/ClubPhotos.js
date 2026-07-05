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
exports.ClubPhotos = void 0;
const typeorm_1 = require("typeorm");
const Clubs_1 = require("./Clubs");
let ClubPhotos = class ClubPhotos {
    id;
    clubId;
    photoUrl;
    sortOrder;
    isPrimary;
    createdAt;
    club;
};
exports.ClubPhotos = ClubPhotos;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)("uuid", { name: "id" }),
    __metadata("design:type", String)
], ClubPhotos.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)("uuid", { name: "club_id" }),
    __metadata("design:type", String)
], ClubPhotos.prototype, "clubId", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { name: "photo_url" }),
    __metadata("design:type", String)
], ClubPhotos.prototype, "photoUrl", void 0);
__decorate([
    (0, typeorm_1.Column)("integer", { name: "sort_order", default: () => "0" }),
    __metadata("design:type", Number)
], ClubPhotos.prototype, "sortOrder", void 0);
__decorate([
    (0, typeorm_1.Column)("boolean", { name: "is_primary", default: () => "false" }),
    __metadata("design:type", Boolean)
], ClubPhotos.prototype, "isPrimary", void 0);
__decorate([
    (0, typeorm_1.Column)("timestamp with time zone", {
        name: "created_at",
        nullable: true,
        default: () => "now()",
    }),
    __metadata("design:type", Object)
], ClubPhotos.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Clubs_1.Clubs, (clubs) => clubs.photos),
    (0, typeorm_1.JoinColumn)([{ name: "club_id", referencedColumnName: "clubId" }]),
    __metadata("design:type", Clubs_1.Clubs)
], ClubPhotos.prototype, "club", void 0);
exports.ClubPhotos = ClubPhotos = __decorate([
    (0, typeorm_1.Entity)("club_photos", { schema: "public" })
], ClubPhotos);
//# sourceMappingURL=ClubPhotos.js.map