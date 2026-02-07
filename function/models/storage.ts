import { ItemPosition, Good } from "./good";
import { LocationType, SpaceLocation } from "./location";
import { LevelSystem, type LevelProperty } from "./level";

type SpaceConnection = { from: LocationType, to: LocationType, travelTime: number, fuelCost: number };

const SpaceConnections: SpaceConnection[] = [
    {from: LocationType.EARTH, to: LocationType.MARS, travelTime: 60, fuelCost: 35},
    {from: LocationType.EARTH, to: LocationType.MOON, travelTime: 15, fuelCost: 10},
    {from: LocationType.MOON, to: LocationType.MARS, travelTime: 45, fuelCost: 27},
    {from: LocationType.SPACE_STATION, to: LocationType.MARS, travelTime: 50, fuelCost: 30},
    {from: LocationType.SPACE_STATION, to: LocationType.MOON, travelTime: 12, fuelCost: 5}
]

abstract class StorageHolder extends LevelSystem {
    private items: ItemPosition[];
    private baseCapacity: number;
    protected scaleFactor: number = 1.02; // For future use in upgrades that increase capacity


    constructor(items: ItemPosition[], capacity: number, initialLevel: number = 1) {
        super(initialLevel);
        this.items = items;
        this.baseCapacity = capacity;
    }
    
    getItemPositions(): ItemPosition[] {
        return this.items;
    }

    protected setItems(items: ItemPosition[]): void {
        this.items = items;
    }

    getTotalQuantity(): number {
        return Math.floor(this.items.reduce((total, item) => total + item.quantity, 0));
    }

    getCapacity(lvl?: number): number {
        return Math.floor(this.baseCapacity * Math.pow(this.scaleFactor, (lvl ?? this.getLevel()) + 1)) ;
    }

    addItemPosition(itemPosition: ItemPosition): boolean {
        if (this.getTotalQuantity() + itemPosition.quantity <= this.getCapacity()) {
            // Check if the item already exists
            const existingItem = this.items.find(item => item.good.getId() === itemPosition.good.getId());
            if (existingItem) {
                existingItem.quantity += itemPosition.quantity;
            } else {
                this.items.push(itemPosition);
            }
            return true;
        } else {
            return false;
        }
    }

    removeItemPosition(goodId: number): void {
        this.items = this.items.filter(item => item.good.getId() !== goodId);
    }

    reduceItemQuantity(goodId: number, amount: number): boolean {
        const item = this.items.find(item => item.good.getId() === goodId);
        if (item) {
            item.quantity -= amount;
            if (item.quantity < 0) {
                item.quantity += amount;
                return false;
            }
            return true;
        } else {
            return false;
        }
    }

    setCapacity(newCapacity: number): void {
        this.baseCapacity = newCapacity;
    }

    protected toStorageData() {
        return {
            items: this.items.map(item => item.toData()),
            level: this.getLevel()
        };
    }
}

class Rocket extends StorageHolder {
    private id: string;
    name: string;
    estimatedTravelTime: number; // in minutes
    locationId: SpaceLocation;
    destinationId: SpaceLocation | null;

    constructor(id: string, name: string, estimatedTravelTime: number, locationId: SpaceLocation, initialLevel: number = 1) {
        super([], 100, initialLevel); // Default capacity of 100 units, level 1
        this.id = id;
        this.name = name;
        this.estimatedTravelTime = estimatedTravelTime;
        this.locationId = locationId;
        this.destinationId = null;
    }

    onUpgrade(): void {}

    override getProperties() {
        return [
            { name: "Travel time", value: this.estimatedTravelTime, increase: 5 },
            { name: "Capacity", value: this.getCapacity(), increase: this.getCapacity(this.getLevel() + 1) - this.getCapacity() },
            { name: "Fuel Efficiency", value: 100, increase: 5 }
        ];
    }

    startTravel(destinationId: SpaceLocation): boolean {
        // Cannot travel if already traveling
        if (this.destinationId) return false;
        
        // Cannot travel to same location
        if (this.locationId.getId() === destinationId.getId()) return false;

        const connection = SpaceConnections.find(conn => conn.from === this.locationId.getType() && conn.to === destinationId.getType());
        
        // If no direct connection, maybe just allow it with default time? 
        // For now, only allow valid connections
        if (connection) {
            this.destinationId = destinationId;
            this.estimatedTravelTime = connection.travelTime;
            return true;
        }
        return false;
    }

    getLocation(): SpaceLocation {
        return this.locationId;
    }

    getDestination(): SpaceLocation | null {
        return this.destinationId;
    }

    completeTravel(): void {
        if (this.destinationId) {
            this.locationId = this.destinationId;
            this.destinationId = null;
            this.estimatedTravelTime = 0;
        }
    }

    toData() {
        return {
            id: this.id,
            name: this.name,
            estimatedTravelTime: this.estimatedTravelTime,
            location: this.locationId.toData(),
            destination: this.destinationId ? this.destinationId.toData() : null,
            storage: this.toStorageData()
        };
    }

    static fromData(data: any, locations: Map<string, SpaceLocation>, goodsRegistry: Map<number, Good>): Rocket {
        const location = locations.get(data.location.uuid) ?? SpaceLocation.fromData(data.location);
        const rocket = new Rocket(data.id, data.name, data.estimatedTravelTime, location, data.storage?.level ?? 1);
        const items = (data.storage?.items ?? []).map((item: any) => ItemPosition.fromData(item, goodsRegistry));
        rocket.setItems(items);
        if (data.destination) {
            const dest = locations.get(data.destination.uuid) ?? SpaceLocation.fromData(data.destination);
            rocket.destinationId = dest;
        }
        return rocket;
    }
}

export { StorageHolder, Rocket, SpaceConnections };