import { ItemPosition, Good } from "./good";
import { LocationType, SpaceLocation } from "./location";
import { LevelSystem, type LevelProperty } from "./level";
import { CONFIG } from "../config";

type SpaceConnection = { from: LocationType, to: LocationType, travelTime: number, fuelCost: number };

const SpaceConnections: SpaceConnection[] = [
    {from: LocationType.EARTH, to: LocationType.MARS, travelTime: 6, fuelCost: 100_000},
    {from: LocationType.EARTH, to: LocationType.MOON, travelTime: 2, fuelCost: 30_000},
    {from: LocationType.MOON, to: LocationType.MARS, travelTime: 5, fuelCost: 50_000},
    {from: LocationType.SPACE_STATION, to: LocationType.MARS, travelTime: 5, fuelCost: 90_000},
    {from: LocationType.SPACE_STATION, to: LocationType.MOON, travelTime: 1, fuelCost: 20_000},
    {from: LocationType.EARTH, to: LocationType.SPACE_STATION, travelTime: 0.5, fuelCost: 500}
]

function findSpaceConnection(from: LocationType, to: LocationType): SpaceConnection | undefined {
    // Try direct connection
    let connection = SpaceConnections.find(conn => conn.from === from && conn.to === to);

    // Try reverse connection
    if (!connection) {
        connection = SpaceConnections.find(conn => conn.from === to && conn.to === from);
    }

    return connection;
}

enum SellRouteState {
    IDLE = 'idle',
    LOADING = 'loading',
    TRAVELING_TO_EARTH = 'to_earth',
    SELLING = 'selling',
    TRAVELING_TO_ORIGIN = 'to_origin'
}

abstract class StorageHolder extends LevelSystem {
    private items: ItemPosition[];
    private baseCapacity: number;
    protected scaleFactor: number = 1.2; // For future use in upgrades that increase capacity


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
    initialTravelTime: number; // total journey duration in minutes
    locationId: SpaceLocation;
    destinationId: SpaceLocation | null;
    sellRoute: boolean = false;              // Is this rocket on a sell route?
    sellRouteOriginId: string | null = null; // Colony ID of the origin
    sellRouteState: SellRouteState = SellRouteState.IDLE;

    constructor(id: string, name: string, estimatedTravelTime: number, locationId: SpaceLocation, initialLevel: number = 1) {
        super([], 100, initialLevel); // Default capacity of 100 units, level 1
        this.id = id;
        this.name = name;
        this.estimatedTravelTime = estimatedTravelTime;
        this.initialTravelTime = 0;
        this.locationId = locationId;
        this.destinationId = null;
    }

    getId(): string {
        return this.id;
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

        const connection = findSpaceConnection(this.locationId.getType(), destinationId.getType());
        
        // If no direct connection, maybe just allow it with default time? 
        // For now, only allow valid connections
        if (connection) {
            this.destinationId = destinationId;
            this.estimatedTravelTime = connection.travelTime * CONFIG.game.minutesPerSol;
            this.initialTravelTime = this.estimatedTravelTime;
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
            this.initialTravelTime = 0;
        }
    }

    toData() {
        return {
            id: this.id,
            name: this.name,
            estimatedTravelTime: this.estimatedTravelTime,
            initialTravelTime: this.initialTravelTime,
            location: this.locationId.toData(),
            destination: this.destinationId ? this.destinationId.toData() : null,
            storage: this.toStorageData(),
            sellRoute: this.sellRoute,
            sellRouteOriginId: this.sellRouteOriginId,
            sellRouteState: this.sellRouteState
        };
    }

    static fromData(data: any, locations: Map<string, SpaceLocation>, goodsRegistry: Map<number, Good>): Rocket {
        const location = locations.get(data.location.uuid) ?? SpaceLocation.fromData(data.location);
        const rocket = new Rocket(data.id, data.name, data.estimatedTravelTime, location, data.storage?.level ?? 1);
        rocket.initialTravelTime = data.initialTravelTime ?? 0;
        const items = (data.storage?.items ?? []).map((item: any) => ItemPosition.fromData(item, goodsRegistry));
        rocket.setItems(items);
        if (data.destination) {
            const dest = locations.get(data.destination.uuid) ?? SpaceLocation.fromData(data.destination);
            rocket.destinationId = dest;
        }
        rocket.sellRoute = data.sellRoute ?? false;
        rocket.sellRouteOriginId = data.sellRouteOriginId ?? null;
        rocket.sellRouteState = data.sellRouteState ?? SellRouteState.IDLE;
        return rocket;
    }
}

export { StorageHolder, Rocket, SpaceConnections, SellRouteState, findSpaceConnection };