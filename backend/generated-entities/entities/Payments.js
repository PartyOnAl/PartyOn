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
exports.Payments = void 0;
const typeorm_1 = require("typeorm");
const Reservations_1 = require("./Reservations");
const Profiles_1 = require("./Profiles");
let Payments = class Payments {
    paymentId;
    amount;
    paymentDate;
    status;
    reservation;
    user;
};
exports.Payments = Payments;
__decorate([
    (0, typeorm_1.Column)("uuid", {
        primary: true,
        name: "payment_id",
        default: () => "uuid_generate_v4()",
    }),
    __metadata("design:type", String)
], Payments.prototype, "paymentId", void 0);
__decorate([
    (0, typeorm_1.Column)("numeric", { name: "amount", precision: 10, scale: 2 }),
    __metadata("design:type", String)
], Payments.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)("timestamp with time zone", {
        name: "payment_date",
        nullable: true,
        default: () => "now()",
    }),
    __metadata("design:type", Object)
], Payments.prototype, "paymentDate", void 0);
__decorate([
    (0, typeorm_1.Column)("text", {
        name: "status",
        nullable: true,
        default: () => "'pending'",
    }),
    __metadata("design:type", Object)
], Payments.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Reservations_1.Reservations, (reservations) => reservations.payments, {
        onDelete: "CASCADE",
    }),
    (0, typeorm_1.JoinColumn)([
        { name: "reservation_id", referencedColumnName: "reservationId" },
    ]),
    __metadata("design:type", Reservations_1.Reservations)
], Payments.prototype, "reservation", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Profiles_1.Profiles, (profiles) => profiles.payments),
    (0, typeorm_1.JoinColumn)([{ name: "user_id", referencedColumnName: "id" }]),
    __metadata("design:type", Profiles_1.Profiles)
], Payments.prototype, "user", void 0);
exports.Payments = Payments = __decorate([
    (0, typeorm_1.Index)("payments_pkey", ["paymentId"], { unique: true }),
    (0, typeorm_1.Entity)("payments", { schema: "public" })
], Payments);
//# sourceMappingURL=Payments.js.map