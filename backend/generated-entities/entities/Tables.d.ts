import { Reservations } from "./Reservations";
import { Clubs } from "./Clubs";
export declare class Tables {
    id: string;
    tableNumber: string;
    seatingCapacity: number;
    minimumSpend: string | null;
    position: string | null;
    location: string | null;
    sector: string | null;
    type: string | null;
    tableStatus: string | null;
    createdAt: Date | null;
    reservations: Reservations[];
    club: Clubs;
}
