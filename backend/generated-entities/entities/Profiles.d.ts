import { Clubs } from "./Clubs";
import { Entries } from "./Entries";
import { Events } from "./Events";
import { Payments } from "./Payments";
import { Reservations } from "./Reservations";
export declare class Profiles {
    id: string;
    name: string | null;
    surname: string | null;
    username: string | null;
    email: string | null;
    birthDate: string | null;
    phoneNumber: string | null;
    role: string;
    clubId: string | null;
    createdAt: Date | null;
    updatedAt: Date | null;
    clubs: Clubs[];
    entries: Entries[];
    events: Events[];
    payments: Payments[];
    reservations: Reservations[];
}
