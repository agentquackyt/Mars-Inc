import { LocationType } from "./location";

enum Category {
    Food = "Food",
    Electronics = "Electronics",
    Clothing = "Clothing",
    Furniture = "Furniture",
    Fuel = "Fuel",
    Science = "Science",
    ISRU = "ISRU"
}

enum ProductionRequirement {
    EVERYWHERE = 0,
    EARTH_ONLY = 1,
    MARS_ONLY = 2,
    MOON_ONLY = 3,
    SPACE_ONLY = 4,
    LOW_GRAVITY_ONLY = 5
}

namespace ProductionRequirement {
    export function isValidForLocation(requirement: ProductionRequirement, locationType: LocationType): boolean {
        switch (requirement) {
            case ProductionRequirement.EVERYWHERE:
                return true;
            case ProductionRequirement.EARTH_ONLY:
                return locationType === LocationType.EARTH;
            case ProductionRequirement.MARS_ONLY:
                return locationType === LocationType.MARS;
            case ProductionRequirement.MOON_ONLY:
                return locationType === LocationType.MOON;
            case ProductionRequirement.SPACE_ONLY:
                return locationType === LocationType.SPACE_STATION;
            case ProductionRequirement.LOW_GRAVITY_ONLY:
                return locationType === LocationType.MARS || locationType === LocationType.SPACE_STATION || locationType === LocationType.MOON;
            default:
                return false;
        }
    }
}


class Good {
    private id: number;
    name: string;
    category: Category;
    productionRequirement: ProductionRequirement;
    baseProductionPerSol: number = 1; // Base production per sol for this good (can be modified by colony modules, etc.)
    marketBuyPrice: number;
    marketSellPrice: number;

    constructor(
        id: number, 
        name: string, 
        category: Category, 
        options: {
            baseProductionPerSol?: number;
            productionRequirement?: ProductionRequirement;
            marketBuyPrice?: number;
            marketSellPrice?: number;
        } = {}
    ) {
        this.id = id;
        this.name = name;
        this.category = category;
        this.baseProductionPerSol = options.baseProductionPerSol ?? 1;
        this.productionRequirement = options.productionRequirement ?? ProductionRequirement.EVERYWHERE;
        this.marketBuyPrice = options.marketBuyPrice ?? 100;
        this.marketSellPrice = options.marketSellPrice ?? 50;
    }

    static fromData(data: any): Good {
        return new Good(data.id, data.name, data.category as Category, {
            baseProductionPerSol: data.baseProductionPerSol,
            productionRequirement: data.productionRequirement as ProductionRequirement,
            marketBuyPrice: data.marketBuyPrice,
            marketSellPrice: data.marketSellPrice
        });
    }

    toData(): any {
        return {
            id: this.id,
            name: this.name,
            category: this.category,
            baseProductionPerSol: this.baseProductionPerSol,
            productionRequirement: this.productionRequirement,
            marketBuyPrice: this.marketBuyPrice,
            marketSellPrice: this.marketSellPrice
        };
    }

    getId(): number {
        return this.id;
    }
}

class ItemPosition {
    good: Good;
    quantity: number;

    constructor(good: Good, quantity: number) {
        this.good = good;
        this.quantity = quantity;
    }

    toData(): any {
        return {
            good: this.good.getId(),
            quantity: this.quantity
        };
    }

    static fromData(data: any, goodsRegistry: Map<number, Good>): ItemPosition {
        const good = goodsRegistry.get(data.good);
        if (!good) {
            throw new Error(`Unknown good id: ${data.good}`);
        }
        return new ItemPosition(good, data.quantity);
    }

}

export { Good, Category, ItemPosition, ProductionRequirement };