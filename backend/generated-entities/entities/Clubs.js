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
exports.Clubs = void 0;
const typeorm_1 = require("typeorm");
const Profiles_1 = require("./Profiles");
const Events_1 = require("./Events");
const Promotions_1 = require("./Promotions");
const Tables_1 = require("./Tables");
const ClubPhotos_1 = require("./ClubPhotos");
let Clubs = class Clubs {
    clubId;
    clubName;
    clubAddress;
    clubEmailId;
    clubPhoneNumber;
    clubImage;
    clubStatus;
    createdAt;
    updatedAt;
    reservationOnly;
    latitude;
    longitude;
    clubDescription;
    clubLat;
    clubLng;
    manager;
    events;
    promotions;
    tables;
    photos;
};
exports.Clubs = Clubs;
__decorate([
    (0, typeorm_1.Column)("uuid", {
        primary: true,
        name: "club_id",
        default: () => "uuid_generate_v4()",
    }),
    __metadata("design:type", String)
], Clubs.prototype, "clubId", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { name: "club_name" }),
    __metadata("design:type", String)
], Clubs.prototype, "clubName", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { name: "club_address", nullable: true }),
    __metadata("design:type", Object)
], Clubs.prototype, "clubAddress", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { name: "club_email_id", nullable: true }),
    __metadata("design:type", Object)
], Clubs.prototype, "clubEmailId", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { name: "club_phone_number", nullable: true }),
    __metadata("design:type", Object)
], Clubs.prototype, "clubPhoneNumber", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { name: "club_image", nullable: true }),
    __metadata("design:type", Object)
], Clubs.prototype, "clubImage", void 0);
__decorate([
    (0, typeorm_1.Column)("text", {
        name: "club_status",
        nullable: true,
        default: () => "'pending'",
    }),
    __metadata("design:type", Object)
], Clubs.prototype, "clubStatus", void 0);
__decorate([
    (0, typeorm_1.Column)("timestamp with time zone", {
        name: "created_at",
        nullable: true,
        default: () => "now()",
    }),
    __metadata("design:type", Object)
], Clubs.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)("timestamp with time zone", {
        name: "updated_at",
        nullable: true,
        default: () => "now()",
    }),
    __metadata("design:type", Object)
], Clubs.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)("boolean", { name: "reservation_only", default: () => "false" }),
    __metadata("design:type", Boolean)
], Clubs.prototype, "reservationOnly", void 0);
__decorate([
    (0, typeorm_1.Column)("numeric", {
        name: "latitude",
        nullable: true,
        precision: 10,
        scale: 8,
    }),
    __metadata("design:type", Object)
], Clubs.prototype, "latitude", void 0);
__decorate([
    (0, typeorm_1.Column)("numeric", {
        name: "longitude",
        nullable: true,
        precision: 11,
        scale: 8,
    }),
    __metadata("design:type", Object)
], Clubs.prototype, "longitude", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { name: "club_description", nullable: true }),
    __metadata("design:type", Object)
], Clubs.prototype, "clubDescription", void 0);
__decorate([
    (0, typeorm_1.Column)("double precision", {
        name: "club_lat",
        nullable: true,
        precision: 53,
    }),
    __metadata("design:type", Object)
], Clubs.prototype, "clubLat", void 0);
__decorate([
    (0, typeorm_1.Column)("double precision", {
        name: "club_lng",
        nullable: true,
        precision: 53,
    }),
    __metadata("design:type", Object)
], Clubs.prototype, "clubLng", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Profiles_1.Profiles, (profiles) => profiles.clubs),
    (0, typeorm_1.JoinColumn)([{ name: "manager_id", referencedColumnName: "id" }]),
    __metadata("design:type", Profiles_1.Profiles)
], Clubs.prototype, "manager", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Events_1.Events, (events) => events.club),
    __metadata("design:type", Array)
], Clubs.prototype, "events", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Promotions_1.Promotions, (promotions) => promotions.club),
    __metadata("design:type", Array)
], Clubs.prototype, "promotions", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Tables_1.Tables, (tables) => tables.club),
    __metadata("design:type", Array)
], Clubs.prototype, "tables", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => ClubPhotos_1.ClubPhotos, (photo) => photo.club),
    __metadata("design:type", Array)
], Clubs.prototype, "photos", void 0);
exports.Clubs = Clubs = __decorate([
    (0, typeorm_1.Index)("clubs_pkey", ["clubId"], { unique: true }),
    (0, typeorm_1.Entity)("clubs", { schema: "public" })
], Clubs);
//# sourceMappingURL=Clubs.js.map