import { Reservations } from "./Reservations";
import { Profiles } from "./Profiles";
import { Events } from "./Events";
export declare class Payments {
    paymentId: string;
    amount: string;
    paymentDate: Date | null;
    status: string | null;
    timesUsed: number | null;
    intent: string | null;
    batchId: string | null;
    reservation: Reservations;
    user: Profiles;
    event: Events;
}
