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
exports.Reservations = void 0;
const typeorm_1 = require("typeorm");
const Entries_1 = require("./Entries");
const Payments_1 = require("./Payments");
const Events_1 = require("./Events");
const Tables_1 = require("./Tables");
const TicketTypes_1 = require("./TicketTypes");
const Profiles_1 = require("./Profiles");
let Reservations = class Reservations {
    reservationId;
    reservationDate;
    notes;
    expectedArrivalTime;
    nrOfPeople;
    type;
    status;
    qrCode;
    createdAt;
    entries;
    payments;
    event;
    table;
    ticketType;
    user;
};
exports.Reservations = Reservations;
__decorate([
    (0, typeorm_1.Column)("uuid", {
        primary: true,
        name: "reservation_id",
        default: () => "uuid_generate_v4()",
    }),
    __metadata("design:type", String)
], Reservations.prototype, "reservationId", void 0);
__decorate([
    (0, typeorm_1.Column)("timestamp with time zone", {
        name: "reservation_date",
        nullable: true,
        default: () => "now()",
    }),
    __metadata("design:type", Object)
], Reservations.prototype, "reservationDate", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { name: "notes", nullable: true }),
    __metadata("design:type", Object)
], Reservations.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)("time without time zone", {
        name: "expected_arrival_time",
        nullable: true,
    }),
    __metadata("design:type", Object)
], Reservations.prototype, "expectedArrivalTime", void 0);
__decorate([
    (0, typeorm_1.Column)("integer", {
        name: "nr_of_people",
        nullable: true,
        default: () => "1",
    }),
    __metadata("design:type", Object)
], Reservations.prototype, "nrOfPeople", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { name: "type", nullable: true, default: () => "'ticket'" }),
    __metadata("design:type", Object)
], Reservations.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)("text", {
        name: "status",
        nullable: true,
        default: () => "'pending'",
    }),
    __metadata("design:type", Object)
], Reservations.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)("text", {
        name: "qr_code",
        nullable: true,
        unique: true,
        default: () => "(uuid_generate_v4())::text",
    }),
    __metadata("design:type", Object)
], Reservations.prototype, "qrCode", void 0);
__decorate([
    (0, typeorm_1.Column)("timestamp with time zone", {
        name: "created_at",
        nullable: true,
        default: () => "now()",
    }),
    __metadata("design:type", Object)
], Reservations.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Entries_1.Entries, (entries) => entries.reservation),
    __metadata("design:type", Array)
], Reservations.prototype, "entries", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Payments_1.Payments, (payments) => payments.reservation),
    __metadata("design:type", Array)
], Reservations.prototype, "payments", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Events_1.Events, (events) => events.reservations),
    (0, typeorm_1.JoinColumn)([{ name: "event_id", referencedColumnName: "eventId" }]),
    __metadata("design:type", Events_1.Events)
], Reservations.prototype, "event", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Tables_1.Tables, (tables) => tables.reservations),
    (0, typeorm_1.JoinColumn)([{ name: "table_id", referencedColumnName: "id" }]),
    __metadata("design:type", Tables_1.Tables)
], Reservations.prototype, "table", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => TicketTypes_1.TicketTypes, (ticketTypes) => ticketTypes.reservations),
    (0, typeorm_1.JoinColumn)([{ name: "ticket_type_id", referencedColumnName: "id" }]),
    __metadata("design:type", TicketTypes_1.TicketTypes)
], Reservations.prototype, "ticketType", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Profiles_1.Profiles, (profiles) => profiles.reservations, {
        onDelete: "CASCADE",
    }),
    (0, typeorm_1.JoinColumn)([{ name: "user_id", referencedColumnName: "id" }]),
    __metadata("design:type", Profiles_1.Profiles)
], Reservations.prototype, "user", void 0);
exports.Reservations = Reservations = __decorate([
    (0, typeorm_1.Index)("reservations_qr_code_key", ["qrCode"], { unique: true }),
    (0, typeorm_1.Index)("reservations_pkey", ["reservationId"], { unique: true }),
    (0, typeorm_1.Entity)("reservations", { schema: "public" })
], Reservations);
//# sourceMappingURL=Reservations.js.map