
import { GameManager } from "../app";
import { GameSession } from "../models/sessionModel";
import { SpaceLocation, LocationType } from "../models/location";
import { Rocket } from "../models/storage";
import { Colony } from "../models/company";
import { ItemPosition } from "../models/good";
import * as GUI from "../gui";

export class UIController {
    private manager: GameManager;
    private container: HTMLElement;
    private selectedEntity: SpaceLocation | Rocket | null = null;

    constructor(manager: GameManager) {
        this.manager = manager;
        this.container = document.getElementById("game-panels") as HTMLElement;
        if (!this.container) {
            // fast-fail or create if missing
            console.error("Game panels container not found");
        }
    }

    public onObjectSelected(entity: SpaceLocation | Rocket | null) {
        this.selectedEntity = entity;
        this.render();
    }

    private render() {
        this.container.innerHTML = "";
        if (!this.selectedEntity) {
            this.container.classList.add("hidden");
            return;
        }

        this.container.classList.remove("hidden");
        const content = document.createElement("div");
        content.className = "panel-content";

        if (this.selectedEntity instanceof Rocket) {
            this.renderRocketPanel(content, this.selectedEntity);
        } else {
            // SpaceLocation
            this.renderLocationPanel(content, this.selectedEntity as SpaceLocation);
        }

        this.container.appendChild(content);
        
        // Add Close Button
        const closeBtn = document.createElement("button");
        closeBtn.className = "btn btn--close";
        closeBtn.textContent = "X";
        closeBtn.onclick = () => this.onObjectSelected(null);
        this.container.appendChild(closeBtn);
    }

    private renderRocketPanel(container: HTMLElement, rocket: Rocket) {
        const h2 = document.createElement("h2");
        h2.textContent = rocket.name;
        container.appendChild(h2);

        const status = document.createElement("div");
        status.innerHTML = `<p>Status: ${rocket.getDestination() ? "Traveling to " + rocket.getDestination()?.name : "Docked at " + rocket.getLocation().name}</p>`;
        container.appendChild(status);

        // Inventory
        this.renderInventory(container, rocket);

        // Actions
        const actions = document.createElement("div");
        actions.className = "panel-actions";
        
        if (!rocket.getDestination()) {
            // Check if docked at a colony
            const session = this.manager.getSession();
            const colony = session.company.colonies.find(c => c.locationId.getId() === rocket.getLocation().getId());

            if (colony) {
                // Transfer Controls
                const transferLabel = document.createElement("h3");
                transferLabel.textContent = "Cargo Operations";
                transferLabel.className = "full-width-label";
                actions.appendChild(transferLabel);

                // Load from Colony (Colony Inventory)
                colony.getItemPositions().forEach(item => {
                    if (item.quantity >= 1) {
                         const btn = document.createElement("button");
                         btn.className = "btn";
                         btn.textContent = `Load ${item.good.name} (10)`;
                         btn.onclick = () => {
                             // Move 10 (or max) from Colony to Rocket
                             const portion = Math.min(10, item.quantity);
                             // Check capacity
                             if (rocket.addItemPosition(new ItemPosition(item.good, portion))) {
                                 colony.reduceItemQuantity(item.good.getId(), portion);
                                 this.render();
                             } else {
                                 alert("Rocket full!"); // Simple feedback
                             }
                         };
                         actions.appendChild(btn);
                    }
                });

                // Unload to Colony (Rocket Inventory)
                rocket.getItemPositions().forEach(item => {
                    const btn = document.createElement("button");
                    btn.className = "btn";
                    btn.textContent = `Unload ${item.good.name} (All)`;
                    btn.onclick = () => {
                        // Move All from Rocket to Colony
                        if (colony.addItemPosition(new ItemPosition(item.good, item.quantity))) {
                            rocket.reduceItemQuantity(item.good.getId(), item.quantity);
                            this.render();
                        } else {
                            alert("Colony storage full!");
                        }
                    };
                    actions.appendChild(btn);
                });
            }

            // Travel Controls
            const travelLabel = document.createElement("h3");
            travelLabel.textContent = "Travel To:";
            travelLabel.className = "full-width-label";
            actions.appendChild(travelLabel);


            // Get valid destinations (all known locations except current)
            // Ideally we get this from GameManager or Session, for now we can iterate known types
            // A better way is to pass the session to UIController
            
            // For now, hardcode 'known' major locations or extract from session if available
            // Let's use manager.session to find available locations
            const locations = new Map<string, SpaceLocation>();
             
            // Collect all "known" locations (Colonies + Warehouses + Default Locations map if we had one global)
            // Using a simple list of types for now as defaults
            const targets = [LocationType.EARTH, LocationType.MOON, LocationType.MARS, LocationType.SPACE_STATION];
            
            targets.forEach(type => {
                if (type === rocket.getLocation().getType()) return; // Don't travel to self

                // Find the specific Location instance for this type from session if it exists (colonized), 
                // else we might need a way to target "unvisited" locations. 
                // The Rocket.startTravel takes a SpaceLocation.
                // We need to resolve the generic SpaceLocation for a type if we don't have a specific colony there.
                // This logic might need a helper in GameManager.
                
                const btn = document.createElement("button");
                btn.className = "btn";
                btn.textContent = type;
                btn.onclick = () => {
                     // We need a proper SpaceLocation instance to travel to.
                     // The GameManager should providing a "getLocationByType" or similar.
                     // For now, we will hack it or add it to GameManager.
                     this.manager.orderRocketTravel(rocket, type);
                     this.render(); // Re-render to update status
                };
                actions.appendChild(btn);
            });
        }
        
        container.appendChild(actions);
    }

    private renderLocationPanel(container: HTMLElement, location: SpaceLocation) {
        const h2 = document.createElement("h2");
        h2.textContent = location.name;
        container.appendChild(h2);

        // Check if we have a colony here
        const session = this.manager.getSession();
        const colony = session.company.colonies.find(c => c.locationId.getId() === location.getId());

        if (colony) {
            const level = document.createElement("p");
            level.textContent = `Level: ${colony.getLevel()}`;
            container.appendChild(level);

            this.renderInventory(container, colony);

            const section = document.createElement("div");
            section.className = "panel-actions";

            const upgradeBtn = document.createElement("button");
            upgradeBtn.className = "btn";
            upgradeBtn.textContent = "Upgrade Colony";
            upgradeBtn.onclick = () => {
                colony.onUpgrade(); // simplified, usually costs money
                this.render();
            };
            section.appendChild(upgradeBtn);

            // Build Rocket Action (Only on Earth for now? Or any colony?)
            // Let's allow building everywhere for now, spawning at location
            const buildRocketBtn = document.createElement("button");
            buildRocketBtn.className = "btn";
            buildRocketBtn.textContent = "Build Rocket (500 Credits)";
            buildRocketBtn.onclick = () => {
                this.manager.buildRocket("New Rocket", location);
                this.render();
            };
            section.appendChild(buildRocketBtn);

            container.appendChild(section);
        } else {
            const p = document.createElement("p");
            p.textContent = "No colony established.";
            container.appendChild(p);

            const buildBtn = document.createElement("button");
            buildBtn.className = "btn";
            buildBtn.textContent = "Establish Colony (1000 Credits)";
            buildBtn.onclick = () => {
                this.manager.establishColony(location);
                this.render();
            };
            container.appendChild(buildBtn);
        }
    }

    private renderInventory(container: HTMLElement, storageParams: any) {
        const div = document.createElement("div");
        div.className = "inventory-section";
        div.innerHTML = "<h3>Inventory</h3>";
        
        const list = document.createElement("ul");
        const items = storageParams.getItemPositions();
        if (items.length === 0) {
            list.innerHTML = "<li>Empty</li>";
        } else {
            items.forEach((item: any) => {
                const li = document.createElement("li");
                li.textContent = `${item.good.name}: ${GUI.formatNumber(item.quantity)}`;
                list.appendChild(li);
            });
        }
        div.appendChild(list);
        container.appendChild(div);
    }

    // Call this every frame or on tick if we want live updates in panel
    public update() {
        if (this.selectedEntity && !this.container.classList.contains("hidden")) {
            // Smart update or just re-render info parts? 
            // Full re-render is easiest for now but might reset interactions.
            // Let's just update texts if we have references, or re-render for simplicity.
            // this.render(); // Careful with loop invalidating buttons being clicked
        }
    }
}
