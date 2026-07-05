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
exports.Entries = void 0;
const typeorm_1 = require("typeorm");
const Reservations_1 = require("./Reservations");
const Profiles_1 = require("./Profiles");
let Entries = class Entries {
    entryId;
    entryTime;
    entryType;
    notes;
    reservation;
    staff;
};
exports.Entries = Entries;
__decorate([
    (0, typeorm_1.Column)("uuid", {
        primary: true,
        name: "entry_id",
        default: () => "uuid_generate_v4()",
    }),
    __metadata("design:type", String)
], Entries.prototype, "entryId", void 0);
__decorate([
    (0, typeorm_1.Column)("timestamp with time zone", {
        name: "entry_time",
        nullable: true,
        default: () => "now()",
    }),
    __metadata("design:type", Object)
], Entries.prototype, "entryTime", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { name: "entry_type", nullable: true }),
    __metadata("design:type", Object)
], Entries.prototype, "entryType", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { name: "notes", nullable: true }),
    __metadata("design:type", Object)
], Entries.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Reservations_1.Reservations, (reservations) => reservations.entries),
    (0, typeorm_1.JoinColumn)([
        { name: "reservation_id", referencedColumnName: "reservationId" },
    ]),
    __metadata("design:type", Reservations_1.Reservations)
], Entries.prototype, "reservation", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Profiles_1.Profiles, (profiles) => profiles.entries),
    (0, typeorm_1.JoinColumn)([{ name: "staff_id", referencedColumnName: "id" }]),
    __metadata("design:type", Profiles_1.Profiles)
], Entries.prototype, "staff", void 0);
exports.Entries = Entries = __decorate([
    (0, typeorm_1.Index)("entries_pkey", ["entryId"], { unique: true }),
    (0, typeorm_1.Entity)("entries", { schema: "public" })
], Entries);
//# sourceMappingURL=Entries.js.map