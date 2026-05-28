import { Reservations } from "./Reservations";
import { Events } from "./Events";
export declare class TicketTypes {
    id: string;
    name: string;
    description: string | null;
    price: string;
    totalQuantity: number;
    soldQuantity: number | null;
    createdAt: Date | null;
    reservations: Reservations[];
    event: Events;
}
