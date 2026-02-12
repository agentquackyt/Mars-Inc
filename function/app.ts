import { GameSession, config } from "./models/sessionModel";
import { Company, Colony, ProductionModule } from "./models/company";
import { Rocket, SpaceConnections, SellRouteState, findSpaceConnection } from "./models/storage";
import { SpaceLocation, LocationType } from "./models/location";
import { Good, Category, ItemPosition } from "./models/good";
import { GoodsRegistry } from "./models/goodsRegistry";
import * as GUI from './gui';
import { hudController } from './hudController';



export class GameManager {
    session: GameSession;
    lastTickTime: number;
    lastRocketUpdateTime: number;
    saveInterval: number = 60000; // Auto-save every minute
    lastSaveTime: number;

    constructor(initialSession?: GameSession) {
        this.lastTickTime = Date.now();
        this.lastRocketUpdateTime = Date.now();
        this.lastSaveTime = Date.now();
        this.session = initialSession ?? this.createNewSession("Mars Inc.");

        // Expose gameManager on window for UI access
        (window as any).gameManager = this;
    }

    createNewSession(playerName: string): GameSession {
        const company = new Company("comp-1", `${playerName}`);
        const session = new GameSession("sess-1", playerName, company);
        
        // Initial setup
        const earth = new SpaceLocation(LocationType.EARTH, "Earth HQ", "loc-earth");

        const hq = new Colony("col-1", "Earth HQ", earth);
        // Add some basic goods production for testing
        let food = GoodsRegistry.get(1);
        if (food) {
            hq.addColonyModule(new ProductionModule(food.getId(), 3));
        }
        company.addColony(hq);
        return session;
    }

    loadSession(json: string) {
        const data = JSON.parse(json);
        this.session = GameSession.fromData(data);
    }

    saveSession(): string {
        return JSON.stringify(this.session.toData());
    }

    setSession(session: GameSession) {
        this.session = session;
    }

    tickCounter: number = 0;
    lastSolPassed: number = 0;

    tick(): boolean {
        const now = Date.now();
        const deltaTimeInSeconds = (now - this.lastTickTime) / 1000;
        const deltaTimeInMinutes = deltaTimeInSeconds / 60;
        this.lastTickTime = now;
        this.tickCounter++;

        let stateChanged = false;
        
        // Update rockets every 30 ticks
        if(this.tickCounter % 30 === 0) {
            const rocketDeltaSeconds = (now - this.lastRocketUpdateTime) / 1000;
            const rocketDeltaMinutes = rocketDeltaSeconds / 60;
            this.lastRocketUpdateTime = now;
            
            this.updateRockets(rocketDeltaMinutes);
            this.updateColonies(deltaTimeInMinutes);
            stateChanged = true;
        }

        if (now - this.lastSaveTime > this.saveInterval) {
            // this.saveSession(); // Logic to persist
            this.lastSaveTime = now;
        }
        
        // Update Sol progress every 10 ticks
        if(this.tickCounter % 10 === 0) {
            const solDurationMs = config.minutesPerSol * 60 * 1000;
            
            // Initialize lastSolPassed if it's 0 (first run)
            if (this.lastSolPassed === 0) {
                this.lastSolPassed = now - (this.session.currentSolProgress * solDurationMs);
            }

            // check if a Sol has passed
            if (now - this.lastSolPassed > solDurationMs) {
                this.passSol();
                stateChanged = true;
            } else {
                const progress = (now - this.lastSolPassed) / solDurationMs;
                this.session.updateSolProgress(progress);
                stateChanged = true;
            }
        }

        // Reset counter to avoid overflow (use a higher limit to allow both 10 and 30 checks)
        if(this.tickCounter >= 300) {
            this.tickCounter = 0;
        }

        return stateChanged;
    }

    // this method should be called when player completes a Sol to trigger any Sol-based events or updates
    private passSol(): void {
        this.lastSolPassed = Date.now();
        // Trigger any Sol-based events here, e.g. random events, market changes, etc.
        console.log("A new Sol has begun!");

        this.session.incrementSol();

        // For now, we just call endOfSolUpdate on colonies to finalize production
        this.session.company.colonies.forEach(colony => {
            colony.endOfSolUpdate();
        });
    }
    
    private updateRockets(deltaMinutes: number): boolean {
        let changed = false;
        this.session.rockets.forEach(rocket => {
            if (rocket.getDestination()) {
                // Rocket is traveling
                // treating estimatedTravelTime as remaining time
                rocket.estimatedTravelTime -= deltaMinutes;
                changed = true;
                
                console.log(`[Rocket Update] ${rocket.name}: ${rocket.estimatedTravelTime.toFixed(2)}min remaining of ${rocket.initialTravelTime.toFixed(2)}min total`);
                
                if (rocket.estimatedTravelTime <= 0) {
                    rocket.completeTravel();
                    console.log(`Rocket ${rocket.name} arrived at ${rocket.getLocation().name}`);

                    // Handle sell route automation BEFORE exploration missions
                    if (rocket.sellRoute) {
                        this.handleSellRouteAutomation(rocket);
                    }

                    const missionIndex = this.session.explorationMissions.findIndex(m => m.rocketId === rocket.getId());
                    if (missionIndex >= 0) {
                        const mission = this.session.explorationMissions[missionIndex];
                        if (mission) {
                            // If this travel was an exploration, establish the colony when the rocket arrives
                            if (rocket.getLocation().getType() === mission.targetType) {
                                const alreadyColonized = this.session.company.colonies.some(c => c.locationId.getType() === mission.targetType);
                                if (!alreadyColonized) {
                                    const newColony = new Colony(
                                        `col-${Date.now()}`,
                                        `${rocket.getLocation().name} Outpost`,
                                        rocket.getLocation()
                                    );
                                    this.session.company.addColony(newColony);
                                    console.log(`Exploration complete: established colony at ${rocket.getLocation().name}`);
                                }
                            }

                            this.session.explorationMissions.splice(missionIndex, 1);
                            changed = true;
                        }
                    }
                }
            }
        });
        return changed;
    }

    updateColonies(deltaTimeInMinutes: number): boolean {
         // Production logic
         // production is per Sol. 1 Sol = config.minutesPerSol
         const solsPassed = deltaTimeInMinutes / config.minutesPerSol;
         
         if (solsPassed < 0.0001) return false; // No meaningful change
         this.session.company.colonies.forEach(colony => {
             colony.tick(solsPassed);
         });
         return true;
    }

    // Actions

    private static readonly EXPLORATION_BASE_PRICE = 100_000;
    private static readonly EXPLORATION_PRICE_BASE = 4;

    getExplorationTargetsForRocket(rocket: Rocket): LocationType[] {
        if (rocket.getDestination()) return [];

        const fromType = rocket.getLocation().getType();

        const colonizedTypes = new Set(this.session.company.colonies.map(c => c.locationId.getType()));
        colonizedTypes.add(LocationType.TRAVELING);

        const candidates = Object.values(LocationType)
            .filter(t => t !== fromType)
            .filter(t => t !== LocationType.TRAVELING)
            .filter(t => !colonizedTypes.has(t as LocationType)) as LocationType[];

        return candidates.filter(targetType =>
            SpaceConnections.some(conn => conn.from === fromType && conn.to === targetType)
        );
    }

    getExplorationQuote(rocket: Rocket, targetType: LocationType): { priceCredits: number; fuelUnits: number; unlockMinutes: number } | null {
        const fromType = rocket.getLocation().getType();
        const connection = SpaceConnections.find(conn => conn.from === fromType && conn.to === targetType);
        if (!connection) return null;

        const colonyCount = this.session.company.colonies.length;
        const exponent = Math.max(0, colonyCount - 1);
        const priceCredits = Math.floor(
            GameManager.EXPLORATION_BASE_PRICE * Math.pow(GameManager.EXPLORATION_PRICE_BASE, exponent)
        );

        const fuelUnits = connection.fuelCost * 2;
        const unlockMinutes = connection.travelTime * config.minutesPerSol * 2;
        return { priceCredits, fuelUnits, unlockMinutes };
    }

    startExploration(rocket: Rocket, targetType: LocationType): { ok: boolean; message?: string; quote?: { priceCredits: number; fuelUnits: number; unlockMinutes: number } } {
        if (rocket.getDestination()) return { ok: false, message: 'Rocket is already traveling.' };
        if (this.session.explorationMissions.some(m => m.rocketId === rocket.getId())) {
            return { ok: false, message: 'Rocket is already on an exploration mission.' };
        }

        const alreadyColonized = this.session.company.colonies.some(c => c.locationId.getType() === targetType);
        if (alreadyColonized) return { ok: false, message: 'Target already has a colony.' };

        const quote = this.getExplorationQuote(rocket, targetType);
        if (!quote) return { ok: false, message: 'No valid route to target.' };

        const originColony = this.session.company.colonies.find(c => c.locationId.getId() === rocket.getLocation().getId());
        if (!originColony) return { ok: false, message: 'Exploration must start from a colony.' };

        const fuelItem = originColony.getItemPositions().find(i => i.good.getId() === 3);
        if (!fuelItem || fuelItem.quantity < quote.fuelUnits) {
            return { ok: false, message: 'Not enough Fuel.' };
        }

        if (!this.session.company.deductMoney(quote.priceCredits)) {
            return { ok: false, message: 'Not enough money.' };
        }

        // Deduct fuel
        originColony.reduceItemQuantity(3, quote.fuelUnits);

        // Start travel to the target location and override duration to represent exploration (round-trip + setup)
        const targetLocation = this.getGlobalLocation(targetType);
        const travelStarted = rocket.startTravel(targetLocation);
        if (!travelStarted) {
            // Refund if travel couldn't start
            this.session.company.addMoney(quote.priceCredits);
            originColony.addItemPosition(new ItemPosition(GoodsRegistry.get(3)!, quote.fuelUnits));
            return { ok: false, message: 'Failed to launch exploration.' };
        }

        rocket.estimatedTravelTime = quote.unlockMinutes;
        rocket.initialTravelTime = quote.unlockMinutes;
        this.session.explorationMissions.push({ rocketId: rocket.getId(), targetType });

        return { ok: true, quote };
    }

    startTravel(rocket: Rocket, targetType: LocationType): boolean {
        if (rocket.getDestination()) {
            console.log('Rocket is already traveling.');
            return false;
        }

        const targetColony = this.session.company.colonies.find(c => c.locationId.getType() === targetType);
        if (!targetColony) {
            console.log('Target location is not colonized.');
            return false;
        }

        const originColony = this.session.company.colonies.find(c => c.locationId.getId() === rocket.getLocation().getId());
        if (!originColony) {
            console.log('Travel must start from a colony.');
            return false;
        }

        const fromType = rocket.getLocation().getType();
        const connection = findSpaceConnection(fromType, targetType);
        if (!connection) {
            console.log('No valid route to target.');
            return false;
        }

        const fuelUnits = connection.fuelCost;
        const fuelItem = originColony.getItemPositions().find(i => i.good.getId() === 3);
        if (!fuelItem || fuelItem.quantity < fuelUnits) {
            console.log('Not enough Fuel.');
            return false;
        }

        // Deduct fuel
        originColony.reduceItemQuantity(3, fuelUnits);

        // Start travel
        const travelStarted = rocket.startTravel(targetColony.locationId);
        if (!travelStarted) {
            // Refund fuel if travel couldn't start
            originColony.addItemPosition(new ItemPosition(GoodsRegistry.get(3)!, fuelUnits));
            console.log('Failed to start travel.');
            return false;
        }

        console.log(`Travel started from ${rocket.getLocation().name} to ${targetColony.name}`);
        return true;
    }
    
    orderRocketTravel(rocket: Rocket, targetType: LocationType) {
        // Find a valid destination object. 
        // If we have a colony/warehouse there, use that location object.
        // If not, we need a generic location object for that type.
        
        let targetLocation: SpaceLocation | undefined;
        
        // Check existing colonies/warehouses
        const existing = this.session.company.colonies.find(c => c.locationId.getType() === targetType);
        if (existing) {
            targetLocation = existing.locationId; // It's stored as SpaceLocation type but might be checking usage
        } else {
             // Check generic locations map?
             // We don't have a central registry of "The Mars" vs "Mars Colony".
             // We should create temporary SpaceLocation if not visited? 
             // Ideally the Session has a map of "World" locations.
             // Let's create one on the fly if needed or search a registry.
             targetLocation = this.getGlobalLocation(targetType);
        }

        if (targetLocation) {
            const success = rocket.startTravel(targetLocation);
            if (success) {
                console.log("Travel started");
            } else {
                console.log("Travel failed - invalid connection or busy");
            }
        }
    }

    establishColony(location: SpaceLocation) {
        // Simplification: Check credits, create colony
        if (this.session.company.credits >= 1000) {
            this.session.company.credits -= 1000;
            const newColony = new Colony(`col-${Date.now()}`, `${location.name} Outpost`, location);
            this.session.company.addColony(newColony);
            console.log("Colony established");
        } else {
            console.log("Not enough credits");
        }
    }

    buildRocket(name: string, location: SpaceLocation) {
        if (this.session.company.credits >= 500) {
            this.session.company.credits -= 500;
            const id = `rkt-${Date.now()}`;
            const rocket = new Rocket(id, name, 0, location);
            this.session.addRocket(rocket);
            console.log("Rocket built");
        } else {
            console.log("Not enough credits");
        }
    }
    
    // Helper to get global location singleton/instance
    private getGlobalLocation(type: LocationType): SpaceLocation {
         // Check if we already have it in session via colonies
         const col = this.session.company.colonies.find(c => c.locationId.getType() === type);
         if (col) return col.locationId;

         // Else create/return default
         // Note: In a real app we'd persist these properly so ID stays same.
         // For now, stable IDs based on type string.
         return new SpaceLocation(type, type, `loc-${type}`);
    }

    // Sell Route Automation
    handleSellRouteAutomation(rocket: Rocket): boolean {
        if (!rocket.sellRoute) return false;

        const currentLocation = rocket.getLocation();

        // Check if we just arrived somewhere
        if (rocket.sellRouteState === SellRouteState.TRAVELING_TO_EARTH) {
            if (currentLocation.getType() === LocationType.EARTH) {
                return this.executeSellAtEarth(rocket);
            }
        } else if (rocket.sellRouteState === SellRouteState.TRAVELING_TO_ORIGIN) {
            const originColony = this.getColonyById(rocket.sellRouteOriginId);
            if (originColony && currentLocation.getId() === originColony.locationId.getId()) {
                return this.executeReloadAtOrigin(rocket);
            }
        } else if (rocket.sellRouteState === SellRouteState.IDLE) {
            // Start new cycle
            return this.startSellRouteFromOrigin(rocket);
        }

        return false;
    }

    private startSellRouteFromOrigin(rocket: Rocket): boolean {
        const originColony = this.getColonyById(rocket.sellRouteOriginId);
        if (!originColony) {
            rocket.sellRoute = false;
            hudController.showToast(`${rocket.name}: Origin colony not found, sell route stopped`, 3000);
            return false;
        }

        // Load all available goods (excluding fuel)
        this.loadAllGoods(rocket, originColony);

        // Find connection to Earth
        const connection = findSpaceConnection(originColony.locationId.getType(), LocationType.EARTH);
        if (!connection) {
            rocket.sellRoute = false;
            hudController.showToast(`${rocket.name}: No route to Earth, sell route stopped`, 3000);
            return false;
        }

        const fuelNeeded = connection.fuelCost;

        // Check fuel availability and auto-buy if needed
        const fuelItem = originColony.getItemPositions().find(i => i.good.getId() === 3);
        const availableFuel = fuelItem ? fuelItem.quantity : 0;

        if (availableFuel < fuelNeeded) {
            const fuelToBuy = fuelNeeded - availableFuel;
            const fuelGood = GoodsRegistry.get(3)!;

            // If not at Earth, multiply price by 10x
            const priceMultiplier = originColony.locationId.getType() === LocationType.EARTH ? 1 : 10;
            const cost = fuelToBuy * fuelGood.marketBuyPrice * priceMultiplier;

            if (!this.session.company.deductMoney(cost)) {
                hudController.showToast(`${rocket.name}: Not enough credits to buy fuel (need ${GUI.formatMoney(cost)})`, 3000);
                return false;
            }

            // Add fuel to origin colony (ignore capacity limits)
            const existingFuel = originColony.getItemPositions().find(i => i.good.getId() === 3);
            if (existingFuel) {
                existingFuel.quantity += fuelToBuy;
            } else {
                originColony.getItemPositions().push(new ItemPosition(fuelGood, fuelToBuy));
            }
        }

        // Deduct fuel and start travel
        originColony.reduceItemQuantity(3, fuelNeeded);
        const earthLocation = this.session.company.colonies.find(c =>
            c.locationId.getType() === LocationType.EARTH
        )!.locationId;

        rocket.startTravel(earthLocation);
        rocket.sellRouteState = SellRouteState.TRAVELING_TO_EARTH;

        return true;
    }

    private executeSellAtEarth(rocket: Rocket): boolean {
        const earthHQ = this.session.company.colonies.find(c =>
            c.locationId.getType() === LocationType.EARTH
        )!;

        // Calculate total value and sell all goods
        let totalEarned = 0;
        const itemsToSell: Array<{ goodId: number, quantity: number }> = [];

        rocket.getItemPositions().forEach(item => {
            const quantity = Math.floor(item.quantity);
            const price = item.good.marketSellPrice * quantity;
            totalEarned += price;
            itemsToSell.push({ goodId: item.good.getId(), quantity });
        });

        // Remove goods and add money
        itemsToSell.forEach(({ goodId, quantity }) => {
            rocket.reduceItemQuantity(goodId, quantity);
        });
        this.session.company.addMoney(totalEarned);

        // Show notification
        hudController.showToast(`${rocket.name} earned ${GUI.formatMoney(totalEarned)}!`, 3000);

        // Prepare return trip
        const originColony = this.getColonyById(rocket.sellRouteOriginId);
        if (!originColony) {
            rocket.sellRoute = false;
            return false;
        }

        const connection = findSpaceConnection(LocationType.EARTH, originColony.locationId.getType());
        if (!connection) {
            rocket.sellRoute = false;
            return false;
        }

        const fuelNeeded = connection.fuelCost;
        const earthFuel = earthHQ.getItemPositions().find(i => i.good.getId() === 3);
        const availableFuel = earthFuel ? earthFuel.quantity : 0;

        // Auto-buy fuel if needed (ignore storage limits)
        if (availableFuel < fuelNeeded) {
            const fuelToBuy = fuelNeeded - availableFuel;
            const fuelGood = GoodsRegistry.get(3)!;
            const cost = fuelToBuy * fuelGood.marketBuyPrice;

            if (!this.session.company.deductMoney(cost)) {
                hudController.showToast(`${rocket.name}: Not enough credits to buy fuel for return trip`, 3000);
                rocket.sellRoute = false;
                return false;
            }

            // Force add fuel (ignore capacity limits)
            const existingFuel = earthHQ.getItemPositions().find(i => i.good.getId() === 3);
            if (existingFuel) {
                existingFuel.quantity += fuelToBuy;
            } else {
                earthHQ.getItemPositions().push(new ItemPosition(fuelGood, fuelToBuy));
            }
        }

        // Deduct fuel and start return
        earthHQ.reduceItemQuantity(3, fuelNeeded);
        rocket.startTravel(originColony.locationId);
        rocket.sellRouteState = SellRouteState.TRAVELING_TO_ORIGIN;

        return true;
    }

    private executeReloadAtOrigin(rocket: Rocket): boolean {
        // Restart the cycle
        rocket.sellRouteState = SellRouteState.IDLE;
        return this.startSellRouteFromOrigin(rocket);
    }

    private loadAllGoods(rocket: Rocket, source: Colony): void {
        const remainingCapacity = rocket.getCapacity() - rocket.getTotalQuantity();
        let loaded = 0;

        // Load all goods except fuel
        const items = source.getItemPositions().filter(i => i.good.getId() !== 3);

        for (const item of items) {
            if (loaded >= remainingCapacity) break;

            const amountToLoad = Math.min(item.quantity, remainingCapacity - loaded);

            if (rocket.addItemPosition(new ItemPosition(item.good, amountToLoad))) {
                source.reduceItemQuantity(item.good.getId(), amountToLoad);
                loaded += amountToLoad;
            }
        }
    }

    private getColonyById(colonyId: string | null): Colony | null {
        if (!colonyId) return null;
        return this.session.company.colonies.find(c => c.colonyId === colonyId) || null;
    }

    getSession(): GameSession {
        return this.session;
    }
    
}

