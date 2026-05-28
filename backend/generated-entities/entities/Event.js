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
exports.Event = void 0;
const typeorm_1 = require("typeorm");
let Event = class Event {
    eventId;
    eventName;
    eventDescription;
    eventStartingDate;
    eventEndingDate;
    eventType;
    eventStatus;
    ticketPrice;
    ticketDiscount;
    finalTicketPrice;
    eventImage;
    eventCapacity;
};
exports.Event = Event;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ type: "integer", name: "event_id" }),
    __metadata("design:type", Number)
], Event.prototype, "eventId", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { name: "event_name" }),
    __metadata("design:type", String)
], Event.prototype, "eventName", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { name: "event_description" }),
    __metadata("design:type", String)
], Event.prototype, "eventDescription", void 0);
__decorate([
    (0, typeorm_1.Column)("date", { name: "event_starting_date" }),
    __metadata("design:type", String)
], Event.prototype, "eventStartingDate", void 0);
__decorate([
    (0, typeorm_1.Column)("date", { name: "event_ending_date" }),
    __metadata("design:type", String)
], Event.prototype, "eventEndingDate", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { name: "event_type" }),
    __metadata("design:type", String)
], Event.prototype, "eventType", void 0);
__decorate([
    (0, typeorm_1.Column)("character varying", { name: "eventStatus", length: 1 }),
    __metadata("design:type", String)
], Event.prototype, "eventStatus", void 0);
__decorate([
    (0, typeorm_1.Column)("numeric", {
        name: "ticketPrice",
        precision: 10,
        scale: 2,
        default: () => "'0'",
    }),
    __metadata("design:type", String)
], Event.prototype, "ticketPrice", void 0);
__decorate([
    (0, typeorm_1.Column)("numeric", {
        name: "ticketDiscount",
        precision: 10,
        scale: 2,
        default: () => "'0'",
    }),
    __metadata("design:type", String)
], Event.prototype, "ticketDiscount", void 0);
__decorate([
    (0, typeorm_1.Column)("numeric", {
        name: "finalTicketPrice",
        precision: 10,
        scale: 2,
        default: () => "'0'",
    }),
    __metadata("design:type", String)
], Event.prototype, "finalTicketPrice", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { name: "event_image" }),
    __metadata("design:type", String)
], Event.prototype, "eventImage", void 0);
__decorate([
    (0, typeorm_1.Column)("integer", { name: "event_capacity", default: () => "0" }),
    __metadata("design:type", Number)
], Event.prototype, "eventCapacity", void 0);
exports.Event = Event = __decorate([
    (0, typeorm_1.Index)("Event_pkey", ["eventId"], { unique: true }),
    (0, typeorm_1.Entity)("Event", { schema: "public" })
], Event);
//# sourceMappingURL=Event.js.map