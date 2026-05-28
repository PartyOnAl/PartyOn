import { Entries } from "./Entries";
import { Payments } from "./Payments";
import { Events } from "./Events";
import { Tables } from "./Tables";
import { TicketTypes } from "./TicketTypes";
import { Profiles } from "./Profiles";
export declare class Reservations {
    reservationId: string;
    reservationDate: Date | null;
    notes: string | null;
    expectedArrivalTime: string | null;
    nrOfPeople: number | null;
    type: string | null;
    status: string | null;
    qrCode: string | null;
    createdAt: Date | null;
    entries: Entries[];
    payments: Payments[];
    event: Events;
    table: Tables;
    ticketType: TicketTypes;
    user: Profiles;
}
