import { Clubs } from "./Clubs";
export declare class ClubPhotos {
    id: string;
    clubId: string;
    photoUrl: string;
    sortOrder: number;
    isPrimary: boolean;
    createdAt: Date | null;
    club: Clubs;
}
