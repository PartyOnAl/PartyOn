import { Reservations } from "./Reservations";
import { Profiles } from "./Profiles";
export declare class Entries {
    entryId: string;
    entryTime: Date | null;
    entryType: string | null;
    notes: string | null;
    reservation: Reservations;
    staff: Profiles;
}
