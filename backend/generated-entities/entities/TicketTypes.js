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
exports.TicketTypes = void 0;
const typeorm_1 = require("typeorm");
const Reservations_1 = require("./Reservations");
const Events_1 = require("./Events");
let TicketTypes = class TicketTypes {
    id;
    name;
    description;
    price;
    totalQuantity;
    soldQuantity;
    createdAt;
    reservations;
    event;
};
exports.TicketTypes = TicketTypes;
__decorate([
    (0, typeorm_1.Column)("uuid", {
        primary: true,
        name: "id",
        default: () => "uuid_generate_v4()",
    }),
    __metadata("design:type", String)
], TicketTypes.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { name: "name" }),
    __metadata("design:type", String)
], TicketTypes.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { name: "description", nullable: true }),
    __metadata("design:type", Object)
], TicketTypes.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)("numeric", { name: "price", precision: 10, scale: 2 }),
    __metadata("design:type", String)
], TicketTypes.prototype, "price", void 0);
__decorate([
    (0, typeorm_1.Column)("integer", { name: "total_quantity", default: () => "100" }),
    __metadata("design:type", Number)
], TicketTypes.prototype, "totalQuantity", void 0);
__decorate([
    (0, typeorm_1.Column)("integer", {
        name: "sold_quantity",
        nullable: true,
        default: () => "0",
    }),
    __metadata("design:type", Object)
], TicketTypes.prototype, "soldQuantity", void 0);
__decorate([
    (0, typeorm_1.Column)("timestamp with time zone", {
        name: "created_at",
        nullable: true,
        default: () => "now()",
    }),
    __metadata("design:type", Object)
], TicketTypes.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Reservations_1.Reservations, (reservations) => reservations.ticketType),
    __metadata("design:type", Array)
], TicketTypes.prototype, "reservations", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Events_1.Events, (events) => events.ticketTypes, {
        onDelete: "CASCADE",
    }),
    (0, typeorm_1.JoinColumn)([{ name: "event_id", referencedColumnName: "eventId" }]),
    __metadata("design:type", Events_1.Events)
], TicketTypes.prototype, "event", void 0);
exports.TicketTypes = TicketTypes = __decorate([
    (0, typeorm_1.Index)("ticket_types_pkey", ["id"], { unique: true }),
    (0, typeorm_1.Entity)("ticket_types", { schema: "public" })
], TicketTypes);
//# sourceMappingURL=TicketTypes.js.map