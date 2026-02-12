import { StorageHolder } from "./storage";
import { LevelSystem, type LevelProperty } from "./level";
import { SpaceLocation } from "./location";
import { getProductionModifierForLocation, SpaceLocation as SpaceLocationClass } from "./location";
import { ItemPosition, Good } from "./good";
import { GoodsRegistry } from "./goodsRegistry";

enum ModuleType {
    PRODUCTION = "production",
    INFRASTRUCTURE = "infrastructure"
}

abstract class Module extends LevelSystem {
    moduleType: ModuleType;

    constructor(moduleType: ModuleType, initialLevel: number = 1) {
        super(initialLevel);
        this.moduleType = moduleType;
    }

    abstract getWorkersNeeded(level?: number): number;
    abstract getModuleIdentifier(): number | InfrastructureType;
    abstract getModuleName(): string;
    abstract toData(): any;
}

// the number is the base value for levling up
enum InfrastructureType {
    // Allow for docking more rockets, producing is unlocked at lvl 1
    ROCKET_LAB = 0,
    STOREROOM = 1
}

interface InfrastructureTypeConfig {
    name: string;
    color: string;
    icon: string;
}

const INFRASTRUCTURE_CONFIGS: Record<number, InfrastructureTypeConfig> = {
    [InfrastructureType.ROCKET_LAB]: {
        name: "Rocket Lab",
        color: "#4a90e2",
        icon: "rocket_launch"
    },
    [InfrastructureType.STOREROOM]: {
        name: "Storeroom",
        color: "#60c531",
        icon: "package_2"
    }
};

/**
 * Used for infrastructure modules that provide various benefits to the colony, such as increased storage capacity or the ability to build rockets.
 */
class InfrastructureModule extends Module {
    infrastructureId: InfrastructureType;

    constructor(infrastructureId: InfrastructureType, initialLevel: number = 1) {
        super(ModuleType.INFRASTRUCTURE, initialLevel);
        this.infrastructureId = infrastructureId;
        this.MAX_LEVEL = 499;
    }

    public getWorkersNeeded(level?: number): number {
        return Math.ceil((level ?? this.getLevel()) / 10)*2 + 1;
    }

    public getModuleIdentifier(): InfrastructureType {
        return this.infrastructureId;
    }

    public getModuleName(): string {
        return INFRASTRUCTURE_CONFIGS[this.infrastructureId]?.name || "Infrastructure";
    }

    public getColor(): string {
        return INFRASTRUCTURE_CONFIGS[this.infrastructureId]?.color || "#888888";
    }

    public getIcon(): string {
        return INFRASTRUCTURE_CONFIGS[this.infrastructureId]?.icon || "build";
    }

    public getBenefitValue(level?: number): number {
        // Calculate benefit based on infrastructure type
        const lvl = level ?? this.getLevel();
        switch (this.infrastructureId) {
            case InfrastructureType.ROCKET_LAB:
                return Math.floor(lvl / 10)+1; // Rockets allowed
            case InfrastructureType.STOREROOM:
                return 200 * Math.pow(1.2, (level ?? this.getLevel()) - 1); // Storage capacity
            default:
                return 0;
        }
    }

    override onUpgrade(): void {
        // Infrastructure benefits increase automatically with level
        return;
    }

    override getProperties(): LevelProperty[] {
        const currentBenefit = this.getBenefitValue();
        const nextBenefit = this.getBenefitValue(this.getLevel() + 1);

        let benefitName = "Benefit";
        switch (this.infrastructureId) {
            case InfrastructureType.ROCKET_LAB:
                benefitName = "Rockets Allowed";
                break;
            case InfrastructureType.STOREROOM:
                benefitName = "Storage Capacity";
                break;
        }

        return [
            { name: benefitName, value: currentBenefit, increase: nextBenefit - currentBenefit },
            { name: "Workers Needed", value: this.getWorkersNeeded(), increase: this.getWorkersNeeded(this.getLevel() + 1) - this.getWorkersNeeded() }
        ];
    }

    toData() {
        return {
            infrastructureId: this.infrastructureId,
            level: this.getLevel()
        };
    }
}

/**
 * Used for production modules that produce a specific good. The quantity produced per sol increases with the module level.
 * The goodId is used to identify which good is produced by this module, and the initialQuantityPerSol is the base production at level 1.
 * The getQuantityPerSol method calculates the current production based on the module level, and the getWorkersNeeded method calculates how many workers are needed to operate the module at its current level.
 */

class ProductionModule extends Module {
    goodId: number;
    initialQuantityPerSol: number;

    constructor(goodId: number, initialLevel: number = 1) {
        super(ModuleType.PRODUCTION, initialLevel);
        this.goodId = goodId;
        this.initialQuantityPerSol = GoodsRegistry.get(goodId)?.baseProductionPerSol ?? 1;
    }

    public getWorkersNeeded(level?: number): number {
        return Math.ceil(this.getQuantityPerSol(level) / 10);
    }

    public getModuleIdentifier(): number {
        return this.goodId;
    }

    public getModuleName(): string {
        const good = GoodsRegistry.get(this.goodId);
        return good ? good.name : `Good #${this.goodId}`;
    }

    public getQuantityPerSol(level?: number): number {
        return this.initialQuantityPerSol * Math.pow(1.2, (level ?? this.getLevel()) - 1);
    }

    override onUpgrade(): void {
        // Increase quantity produced per sol by 2% on each upgrade
        return;
    }

    override getProperties(): LevelProperty[] {
        return [
            { name: "Production (t/sol)", value: this.getQuantityPerSol(), increase: this.getQuantityPerSol(this.getLevel() + 1) - this.getQuantityPerSol() },
            { name: "Workers Needed", value: this.getWorkersNeeded(), increase: this.getWorkersNeeded(this.getLevel() + 1) - this.getWorkersNeeded() }
        ];
    }

    toData() {
        return {
            goodId: this.goodId,
            level: this.getLevel()
        };
    }
} 

class Colony extends StorageHolder {
    colonyId: string;
    name: string;
    locationId: SpaceLocation;
    private colonyModules: Module[] = [];

    constructor(colonyId: string, name: string, locationId: SpaceLocation, initialLevel: number = 1, colonyModules: Module[] = []) {
        super([], 100, initialLevel); // Start at level 1, empty items, capacity 100
        this.colonyId = colonyId;
        this.name = name;
        this.locationId = locationId;
        this.colonyModules = colonyModules;

        this.scaleFactor = 1.175; // Colonies have a more modest capacity growth
        this.MAX_LEVEL = 1499;
    }

    onUpgrade(): void {
        // Increase production multiplier by 2% on each upgrade
        return;
    }

    getProductionMultiplier(): number {
        return getProductionModifierForLocation(this.locationId.getType()) * getProductionModifierForLocation(this.locationId.getType()) * Math.pow(1.02, this.getLevel() - 1);
    }

    override getCapacity(lvl?: number): number {
        // Get base capacity from the colony level
        const baseCapacity = super.getCapacity(lvl);
        
        // Add capacity from all STOREROOM infrastructure modules
        const storeroomBonus = this.getInfrastructureModules()
            .filter(module => module.infrastructureId === InfrastructureType.STOREROOM)
            .reduce((total, module) => total + module.getBenefitValue(), 0);
        
        return getProductionModifierForLocation(this.locationId.getType()) * getProductionModifierForLocation(this.locationId.getType()) *  Math.floor(baseCapacity + storeroomBonus);
    }

    addColonyModule(module: Module): boolean {
        if( this.colonyModules.length >= this.getCompanyModulesAllowed()) {
            return false;
        }
        this.colonyModules.push(module);
        return true;
    }

    removeColonyModule(module: Module) {
        this.colonyModules = this.colonyModules.filter(m => m !== module);
    }

    getCompanyModulesAllowed(lvl?: number): number {
        const level = lvl ?? this.getLevel();
        if (level >= 999) return 15;
        if (level >= 200) return 12;
        if (level >= 50) return 9;
        if (level >= 10) return 6;
        return 3;
    }

    getColonyModules(): Module[] {
        return this.colonyModules;
    }

    getProductionModules(): ProductionModule[] {
        return this.colonyModules.filter(m => m instanceof ProductionModule) as ProductionModule[];
    }

    getInfrastructureModules(): InfrastructureModule[] {
        return this.colonyModules.filter(m => m instanceof InfrastructureModule) as InfrastructureModule[];
    }

    getTotalProductionPerSol(): { goodId: number; quantity: number }[] {
        const multiplier = this.getProductionMultiplier();
        const productionMap: Map<number, number> = new Map();

        // Only iterate over production modules
        const productionModules = this.getProductionModules();
        productionModules.forEach(module => {
            const qty = module.getQuantityPerSol() * multiplier;
            if (productionMap.has(module.goodId)) {
                productionMap.set(module.goodId, productionMap.get(module.goodId)! + qty);
            } else {
                productionMap.set(module.goodId, qty);
            }
        });

        const productionArray: { goodId: number; quantity: number }[] = [];
        productionMap.forEach((quantity, goodId) => {
            productionArray.push({ goodId, quantity });
        });

        return productionArray;
    }

    override getProperties(): LevelProperty[] {
        return [
            { name: "Storage Capacity", value: this.getCapacity(), increase: this.getCapacity(this.getLevel() + 1) - this.getCapacity() },
            { name: "Production Multiplier", value: parseFloat(this.getProductionMultiplier().toFixed(2)), increase: parseFloat((this.getProductionMultiplier() * 1.02 - this.getProductionMultiplier()).toFixed(2)) },
            { name: "Colony Modules", value: this.getCompanyModulesAllowed(), increase: this.getCompanyModulesAllowed(this.getLevel() + 1) - this.getCompanyModulesAllowed() }
        ];
    }

    toData() {
        return {
            colonyId: this.colonyId,
            name: this.name,
            location: (this.locationId as SpaceLocationClass).toData(),
            colonyModules: this.colonyModules.map(module => ({
                type: module.moduleType,
                ...module.toData()
            })),
            storage: {
                items: this.getItemPositions().map(item => item.toData()),
                level: this.getLevel()
            }
        };
    }

    static fromData(data: any, goodsRegistry: Map<number, Good>): Colony {
        const location = SpaceLocationClass.fromData(data.location);
        const colony = new Colony(data.colonyId, data.name, location, data.storage?.level ?? 1, []);
        const items = (data.storage?.items ?? []).map((item: any) => ItemPosition.fromData(item, goodsRegistry));
        colony.setItems(items);
        const entries = data.colonyModules ?? [];
        colony.colonyModules = entries.map((entry: any) => {
            // Check module type to deserialize correctly
            if (entry.type === ModuleType.INFRASTRUCTURE) {
                return new InfrastructureModule(entry.infrastructureId, entry.level ?? 1);
            } else {
                // Default to ProductionModule for backwards compatibility
                return new ProductionModule(entry.goodId, entry.level ?? 1);
            }
        });
        return colony;
    }

    tick(solsPassed: number) {}

    endOfSolUpdate() {
        this.getTotalProductionPerSol().forEach(prod => {
            const producedAmount = prod.quantity;
            if (producedAmount > 0) {
                const good = GoodsRegistry.get(prod.goodId);
                if (good) {
                    let success = this.addItemPosition(new ItemPosition(good, producedAmount));
                    if (!success) {
                        // Handle overflow, e.g. by selling excess goods or storing them in a lost-and-found
                        let freeRoom = this.getCapacity() - this.getTotalQuantity();
                        this.addItemPosition(new ItemPosition(good, freeRoom));
                        console.log(`Colony ${this.name} produced ${producedAmount} of ${good.name}, but storage is full! Excess goods are lost.`);
                    }
                }
            }
        });
    }
}

class Company extends LevelSystem {
    
    id: string;
    name: string;
    credits: number;
    colonies: Colony[];

    constructor(id: string, name: string) {
        super(1);
        this.id = id;
        this.name = name;
        this.credits = 5000;
        this.colonies = [];
    }
    
    onUpgrade(): void {
        // Maybe nothing for company level yet? or reputation?
    }
    
    getMoney(): number {
        return this.credits;
    }

    setMoney(amount: number): void {
        this.credits = amount;
    }

    addMoney(amount: number): void {
        this.credits += amount;
    }

    deductMoney(amount: number): boolean {
        if (this.credits >= amount) {
            this.credits -= amount;
            return true;
        }
        return false;
    }
    
    addColony(colony: Colony) {
        this.colonies.push(colony);
    }

    toData() {
        return {
            id: this.id,
            name: this.name,
            credits: this.credits,
            level: this.getLevel(),
            colonies: this.colonies.map(colony => colony.toData())
        };
    }

    override getProperties(): LevelProperty[] {
        return [];
    }

    static fromData(data: any, goodsRegistry: Map<number, Good>): Company {
        const company = new Company(data.id, data.name);
        company.credits = data.credits ?? company.credits;
        company.setLevel(data.level ?? 1);
        company.colonies = (data.colonies ?? []).map((col: any) => Colony.fromData(col, goodsRegistry));
        return company;
    }
}

export { Colony, Company, ProductionModule, InfrastructureModule, Module, ModuleType, InfrastructureType, INFRASTRUCTURE_CONFIGS };
