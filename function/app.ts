import { GameSession, config } from "./models/sessionModel";
import { Company, Colony, ProductionModule } from "./models/company";
import { Rocket, SpaceConnections } from "./models/storage";
import { SpaceLocation, LocationType } from "./models/location";
import { Good, Category, ItemPosition } from "./models/good";
import { GoodsRegistry } from "./models/goodsRegistry";



export class GameManager {
    session: GameSession;
    lastTickTime: number;
    saveInterval: number = 60000; // Auto-save every minute
    lastSaveTime: number;

    constructor(initialSession?: GameSession) {
        this.lastTickTime = Date.now();
        this.lastSaveTime = Date.now();
        this.session = initialSession ?? this.createNewSession("Mars Inc.");
    }

    createNewSession(playerName: string): GameSession {
        const company = new Company("comp-1", `${playerName}`);
        const session = new GameSession("sess-1", playerName, company);
        
        // Initial setup
        const earth = new SpaceLocation(LocationType.EARTH, "Earth HQ", "loc-earth");
        const mars = new SpaceLocation(LocationType.MARS, "Ares Base", "loc-mars");

        const hq = new Colony("col-1", "Earth HQ", earth);
        // Add some basic goods production for testing
        hq.addColonyModule(new ProductionModule(1, 1)); // Food
        company.addColony(hq);

        // Add a starting rocket
        const rocket = new Rocket("rkt-1", "Starship Alpha", 60, earth, 1);
        session.addRocket(rocket);

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

    // Main game loop tick, delta in seconds? or just generic tick
    // Returns true if game state changed
    tickCounter: number = 0;
    lastSolPassed: number = 0;

    tick(): boolean {
        const now = Date.now();
        const deltaTimeInSeconds = (now - this.lastTickTime) / 1000;
        const deltaTimeInMinutes = deltaTimeInSeconds / 60;
        this.lastTickTime = now;
        this.tickCounter++;

        let stateChanged = false;
        
        if(this.tickCounter % 30 === 0) {
            this.updateRockets(deltaTimeInMinutes);
            this.updateColonies(deltaTimeInMinutes);
            stateChanged = true;
        }

        if (now - this.lastSaveTime > this.saveInterval) {
            // this.saveSession(); // Logic to persist
            this.lastSaveTime = now;
        }
        

        if(this.tickCounter % 100 === 0) {
            this.tickCounter = 0; // Reset counter on change to avoid overflow

            // check if a Sol has passed
            if (now - this.lastSolPassed > config.minutesPerSol * 60 * 1000) {
                this.passSol();
                stateChanged = true;
            }
        }

        return stateChanged;
    }

    // this method should be called when player completes a Sol to trigger any Sol-based events or updates
    private passSol(): void {
        this.lastSolPassed = Date.now();
        // Trigger any Sol-based events here, e.g. random events, market changes, etc.
        console.log("A new Sol has begun!");

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
                
                if (rocket.estimatedTravelTime <= 0) {
                    rocket.completeTravel();
                    console.log(`Rocket ${rocket.name} arrived at ${rocket.getLocation().name}`);
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

    getSession(): GameSession {
        return this.session;
    }
    
}

