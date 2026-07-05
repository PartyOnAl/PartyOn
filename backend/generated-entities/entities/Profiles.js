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
exports.Profiles = void 0;
const typeorm_1 = require("typeorm");
const Clubs_1 = require("./Clubs");
const Entries_1 = require("./Entries");
const Events_1 = require("./Events");
const Payments_1 = require("./Payments");
const Reservations_1 = require("./Reservations");
let Profiles = class Profiles {
    id;
    name;
    surname;
    username;
    email;
    birthDate;
    phoneNumber;
    role;
    clubId;
    createdAt;
    updatedAt;
    clubs;
    entries;
    events;
    payments;
    reservations;
};
exports.Profiles = Profiles;
__decorate([
    (0, typeorm_1.Column)("uuid", { primary: true, name: "id" }),
    __metadata("design:type", String)
], Profiles.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { name: "name", nullable: true }),
    __metadata("design:type", Object)
], Profiles.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { name: "surname", nullable: true }),
    __metadata("design:type", Object)
], Profiles.prototype, "surname", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { name: "username", nullable: true, unique: true }),
    __metadata("design:type", Object)
], Profiles.prototype, "username", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { name: "email", nullable: true }),
    __metadata("design:type", Object)
], Profiles.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)("date", { name: "birth_date", nullable: true }),
    __metadata("design:type", Object)
], Profiles.prototype, "birthDate", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { name: "phone_number", nullable: true }),
    __metadata("design:type", Object)
], Profiles.prototype, "phoneNumber", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { name: "role", default: () => "'user'" }),
    __metadata("design:type", String)
], Profiles.prototype, "role", void 0);
__decorate([
    (0, typeorm_1.Column)("uuid", { name: "club_id", nullable: true }),
    __metadata("design:type", Object)
], Profiles.prototype, "clubId", void 0);
__decorate([
    (0, typeorm_1.Column)("timestamp with time zone", {
        name: "created_at",
        nullable: true,
        default: () => "now()",
    }),
    __metadata("design:type", Object)
], Profiles.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)("timestamp with time zone", {
        name: "updated_at",
        nullable: true,
        default: () => "now()",
    }),
    __metadata("design:type", Object)
], Profiles.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Clubs_1.Clubs, (clubs) => clubs.manager),
    __metadata("design:type", Array)
], Profiles.prototype, "clubs", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Entries_1.Entries, (entries) => entries.staff),
    __metadata("design:type", Array)
], Profiles.prototype, "entries", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Events_1.Events, (events) => events.createdBy),
    __metadata("design:type", Array)
], Profiles.prototype, "events", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Payments_1.Payments, (payments) => payments.user),
    __metadata("design:type", Array)
], Profiles.prototype, "payments", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Reservations_1.Reservations, (reservations) => reservations.user),
    __metadata("design:type", Array)
], Profiles.prototype, "reservations", void 0);
exports.Profiles = Profiles = __decorate([
    (0, typeorm_1.Index)("profiles_pkey", ["id"], { unique: true }),
    (0, typeorm_1.Index)("profiles_username_key", ["username"], { unique: true }),
    (0, typeorm_1.Entity)("profiles", { schema: "public" })
], Profiles);
//# sourceMappingURL=Profiles.js.map