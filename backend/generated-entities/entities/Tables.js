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
exports.Tables = void 0;
const typeorm_1 = require("typeorm");
const Reservations_1 = require("./Reservations");
const Clubs_1 = require("./Clubs");
let Tables = class Tables {
    id;
    tableNumber;
    seatingCapacity;
    minimumSpend;
    position;
    location;
    sector;
    type;
    tableStatus;
    createdAt;
    reservations;
    club;
};
exports.Tables = Tables;
__decorate([
    (0, typeorm_1.Column)("uuid", {
        primary: true,
        name: "id",
        default: () => "uuid_generate_v4()",
    }),
    __metadata("design:type", String)
], Tables.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { name: "table_number" }),
    __metadata("design:type", String)
], Tables.prototype, "tableNumber", void 0);
__decorate([
    (0, typeorm_1.Column)("integer", { name: "seating_capacity" }),
    __metadata("design:type", Number)
], Tables.prototype, "seatingCapacity", void 0);
__decorate([
    (0, typeorm_1.Column)("numeric", {
        name: "minimum_spend",
        nullable: true,
        precision: 10,
        scale: 2,
    }),
    __metadata("design:type", Object)
], Tables.prototype, "minimumSpend", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { name: "position", nullable: true }),
    __metadata("design:type", Object)
], Tables.prototype, "position", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { name: "location", nullable: true }),
    __metadata("design:type", Object)
], Tables.prototype, "location", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { name: "sector", nullable: true }),
    __metadata("design:type", Object)
], Tables.prototype, "sector", void 0);
__decorate([
    (0, typeorm_1.Column)("text", { name: "type", nullable: true }),
    __metadata("design:type", Object)
], Tables.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)("text", {
        name: "table_status",
        nullable: true,
        default: () => "'available'",
    }),
    __metadata("design:type", Object)
], Tables.prototype, "tableStatus", void 0);
__decorate([
    (0, typeorm_1.Column)("timestamp with time zone", {
        name: "created_at",
        nullable: true,
        default: () => "now()",
    }),
    __metadata("design:type", Object)
], Tables.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Reservations_1.Reservations, (reservations) => reservations.table),
    __metadata("design:type", Array)
], Tables.prototype, "reservations", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Clubs_1.Clubs, (clubs) => clubs.tables, { onDelete: "CASCADE" }),
    (0, typeorm_1.JoinColumn)([{ name: "club_id", referencedColumnName: "clubId" }]),
    __metadata("design:type", Clubs_1.Clubs)
], Tables.prototype, "club", void 0);
exports.Tables = Tables = __decorate([
    (0, typeorm_1.Index)("tables_pkey", ["id"], { unique: true }),
    (0, typeorm_1.Entity)("tables", { schema: "public" })
], Tables);
//# sourceMappingURL=Tables.js.map