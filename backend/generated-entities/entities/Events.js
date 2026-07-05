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
exports.Events = void 0;
const typeorm_1 = require("typeorm");
const Bookmarks_1 = require("./Bookmarks");
const Clubs_1 = require("./Clubs");
const Profiles_1 = require("./Profiles");
const Reservations_1 = require("./Reservations");
const TicketTypes_1 = require("./TicketTypes");
let Events = class Events {
    eventId;
    eventName;
    eventDescription;
    eventType;
    eventHours;
    eventStartingDate;
    eventEndingDate;
    eventCapacity;
    eventImage;
    eventStatus;
    isFeatured;
    finalTicketPrice;
    ticketPrice;
    ticketDiscount;
    specialGuests;
    createdAt;
    updatedAt;
    featuredRequestStatus;
    reservationOnly;
    bookmarks;
    club;
    createdBy;
    reservations;
    ticketTypes;
};
exports.Events = Events;
__decorate([
    (0, typeorm_1.Column)("uuid", {
        primary: true,
        name: "event_id",
        default: () => "uuid_generate_v4()",
    }),
    __metadata("design:type", String)
], Events.prototype, "eventId", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { name: "event_name" }),
    __metadata("design:type", String)
], Events.prototype, "eventName", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { name: "event_description", nullable: true }),
    __metadata("design:type", Object)
], Events.prototype, "eventDescription", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { name: "event_type", nullable: true }),
    __metadata("design:type", Object)
], Events.prototype, "eventType", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { name: "event_hours", nullable: true }),
    __metadata("design:type", Object)
], Events.prototype, "eventHours", void 0);
__decorate([
    (0, typeorm_1.Column)("timestamp with time zone", { name: "event_starting_date" }),
    __metadata("design:type", Date)
], Events.prototype, "eventStartingDate", void 0);
__decorate([
    (0, typeorm_1.Column)("timestamp with time zone", {
        name: "event_ending_date",
        nullable: true,
    }),
    __metadata("design:type", Object)
], Events.prototype, "eventEndingDate", void 0);
__decorate([
    (0, typeorm_1.Column)("integer", { name: "event_capacity", nullable: true }),
    __metadata("design:type", Object)
], Events.prototype, "eventCapacity", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { name: "event_image", nullable: true }),
    __metadata("design:type", Object)
], Events.prototype, "eventImage", void 0);
__decorate([
    (0, typeorm_1.Column)("text", {
        name: "event_status",
        nullable: true,
        default: () => "'draft'",
    }),
    __metadata("design:type", Object)
], Events.prototype, "eventStatus", void 0);
__decorate([
    (0, typeorm_1.Column)("boolean", {
        name: "is_featured",
        nullable: true,
        default: () => "false",
    }),
    __metadata("design:type", Object)
], Events.prototype, "isFeatured", void 0);
__decorate([
    (0, typeorm_1.Column)("numeric", {
        name: "final_ticket_price",
        nullable: true,
        precision: 10,
        scale: 2,
    }),
    __metadata("design:type", Object)
], Events.prototype, "finalTicketPrice", void 0);
__decorate([
    (0, typeorm_1.Column)("numeric", {
        name: "ticket_price",
        nullable: true,
        precision: 10,
        scale: 2,
    }),
    __metadata("design:type", Object)
], Events.prototype, "ticketPrice", void 0);
__decorate([
    (0, typeorm_1.Column)("numeric", {
        name: "ticket_discount",
        nullable: true,
        precision: 5,
        scale: 2,
        default: () => "0",
    }),
    __metadata("design:type", Object)
], Events.prototype, "ticketDiscount", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { name: "special_guests", nullable: true }),
    __metadata("design:type", Object)
], Events.prototype, "specialGuests", void 0);
__decorate([
    (0, typeorm_1.Column)("timestamp with time zone", {
        name: "created_at",
        nullable: true,
        default: () => "now()",
    }),
    __metadata("design:type", Object)
], Events.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.Column)("timestamp with time zone", {
        name: "updated_at",
        nullable: true,
        default: () => "now()",
    }),
    __metadata("design:type", Object)
], Events.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)("text", {
        name: "featured_request_status",
        nullable: true,
        default: () => "'none'",
    }),
    __metadata("design:type", Object)
], Events.prototype, "featuredRequestStatus", void 0);
__decorate([
    (0, typeorm_1.Column)("boolean", { name: "reservation_only", default: () => "false" }),
    __metadata("design:type", Boolean)
], Events.prototype, "reservationOnly", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Bookmarks_1.Bookmarks, (bookmarks) => bookmarks.event),
    __metadata("design:type", Array)
], Events.prototype, "bookmarks", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Clubs_1.Clubs, (clubs) => clubs.events, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)([{ name: "club_id", referencedColumnName: "clubId" }]),
    __metadata("design:type", Clubs_1.Clubs)
], Events.prototype, "club", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Profiles_1.Profiles, (profiles) => profiles.events),
    (0, typeorm_1.JoinColumn)([{ name: "created_by", referencedColumnName: "id" }]),
    __metadata("design:type", Profiles_1.Profiles)
], Events.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Reservations_1.Reservations, (reservations) => reservations.event),
    __metadata("design:type", Array)
], Events.prototype, "reservations", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => TicketTypes_1.TicketTypes, (ticketTypes) => ticketTypes.event),
    __metadata("design:type", Array)
], Events.prototype, "ticketTypes", void 0);
exports.Events = Events = __decorate([
    (0, typeorm_1.Index)("events_pkey", ["eventId"], { unique: true }),
    (0, typeorm_1.Entity)("events", { schema: "public" })
], Events);
//# sourceMappingURL=Events.js.map