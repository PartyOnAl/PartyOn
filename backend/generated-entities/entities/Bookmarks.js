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
exports.Bookmarks = void 0;
const typeorm_1 = require("typeorm");
const Events_1 = require("./Events");
let Bookmarks = class Bookmarks {
    id;
    userId;
    eventId;
    createdAt;
    event;
};
exports.Bookmarks = Bookmarks;
__decorate([
    (0, typeorm_1.Column)("uuid", {
        primary: true,
        name: "id",
        default: () => "uuid_generate_v4()",
    }),
    __metadata("design:type", String)
], Bookmarks.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)("uuid", { name: "user_id", nullable: true }),
    __metadata("design:type", Object)
], Bookmarks.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)("uuid", { name: "event_id", nullable: true }),
    __metadata("design:type", Object)
], Bookmarks.prototype, "eventId", void 0);
__decorate([
    (0, typeorm_1.Column)("timestamp with time zone", {
        name: "created_at",
        nullable: true,
        default: () => "now()",
    }),
    __metadata("design:type", Object)
], Bookmarks.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Events_1.Events, (events) => events.bookmarks, {
        onDelete: "CASCADE",
    }),
    (0, typeorm_1.JoinColumn)([{ name: "event_id", referencedColumnName: "eventId" }]),
    __metadata("design:type", Events_1.Events)
], Bookmarks.prototype, "event", void 0);
exports.Bookmarks = Bookmarks = __decorate([
    (0, typeorm_1.Index)("bookmarks_user_id_event_id_key", ["eventId", "userId"], {
        unique: true,
    }),
    (0, typeorm_1.Index)("bookmarks_pkey", ["id"], { unique: true }),
    (0, typeorm_1.Entity)("bookmarks", { schema: "public" })
], Bookmarks);
//# sourceMappingURL=Bookmarks.js.map