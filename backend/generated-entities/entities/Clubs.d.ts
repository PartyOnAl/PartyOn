import { Profiles } from "./Profiles";
import { Events } from "./Events";
import { Promotions } from "./Promotions";
import { Tables } from "./Tables";
import { ClubPhotos } from "./ClubPhotos";
export declare class Clubs {
    clubId: string;
    clubName: string;
    clubAddress: string | null;
    clubEmailId: string | null;
    clubPhoneNumber: string | null;
    clubImage: string | null;
    clubStatus: string | null;
    createdAt: Date | null;
    updatedAt: Date | null;
    reservationOnly: boolean;
    latitude: string | null;
    longitude: string | null;
    clubDescription: string | null;
    clubLat: number | null;
    clubLng: number | null;
    manager: Profiles;
    events: Events[];
    promotions: Promotions[];
    tables: Tables[];
    photos?: ClubPhotos[];
}
