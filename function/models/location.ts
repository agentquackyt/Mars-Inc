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

export { LocationType, SpaceLocation };