enum LocationType {
    EARTH = "Earth",
    MOON = "Moon",
    MARS = "Mars",
    SPACE_STATION = "Space Station",
    TRAVELING = "Traveling"
}

class SpaceLocation {
    type: LocationType;
    name: string;
    uuid: string;

    constructor(type: LocationType, name: string, uuid: string) {
        this.type = type;
        this.name = name;
        this.uuid = uuid;
    }

    static fromData(data: any): SpaceLocation {
        return new SpaceLocation(data.type as LocationType, data.name, data.uuid);
    }
    toData(): any {
        return {
            type: this.type,
            name: this.name,
            uuid: this.uuid
        };
    }

    getId() : string {
        return this.uuid;
    }
    
    getType(): LocationType {
        return this.type;
    }
}


function getProductionModifierForLocation(locationType: LocationType): number {
    switch (locationType) {
        case LocationType.MARS:
            return 5; // Reduced production on Mars
        case LocationType.MOON:
            return 4; // Slightly reduced production on the Moon
        case LocationType.SPACE_STATION:
            return 0.5; // Reduced production in space stations
        case LocationType.TRAVELING:
            return 0;
        default:
            return 1.0;
    }
}

export { LocationType, SpaceLocation, getProductionModifierForLocation };