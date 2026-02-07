import type { GameSession } from "../models/sessionModel";
import { LocationType } from "../models/location";
import { Assets } from "../rendering/assets";

const locationPositions: Record<LocationType, { x: number; y: number }> = {
    [LocationType.EARTH]: { x: 0.15, y: 0.65 },
    [LocationType.MOON]: { x: 0.28, y: 0.5 },
    [LocationType.MARS]: { x: 0.8, y: 0.35 },
    [LocationType.SPACE_STATION]: { x: 0.5, y: 0.25 },
    [LocationType.TRAVELING]: { x: -100, y: -100 } // Not used for static nodes
};

const locationAssets: Record<LocationType, string> = {
    [LocationType.EARTH]: Assets.Earth,
    [LocationType.MOON]: Assets.Moon,
    [LocationType.MARS]: Assets.Mars,
    [LocationType.SPACE_STATION]: Assets.SpaceStation,
    [LocationType.TRAVELING]: ""
};

export class DomRenderer {
    private sceneLayer: HTMLElement;
    private getSession: () => GameSession;
    private nodes: Map<string, HTMLElement> = new Map();
    private rocketNodes: Map<string, HTMLElement> = new Map();
    private onLocationClick: (locType: LocationType) => void;

    constructor(sceneLayer: HTMLElement, getSession: () => GameSession, onLocationClick: (locType: LocationType) => void) {
        this.sceneLayer = sceneLayer;
        this.getSession = getSession;
        this.onLocationClick = onLocationClick;
        this.initBackground();
        window.addEventListener("resize", () => this.drawRockets()); // Reposition rockets on resize
    }

    private initBackground() {
        this.sceneLayer.style.setProperty('--bg-image', `url('${Assets.Background}')`);
    }

    render() {
        this.drawLocations();
        this.drawRockets();
    }

    private drawLocations() {
        const session = this.getSession();
        const locations = new Map<LocationType, string>();
        
        session.company.colonies.forEach(col => locations.set(col.locationId.getType(), col.name));
        
        // Ensure standard locations exist visually even if not colonized yet? 
        // For now, let's just render what we have plus known uncolonized spots if needed. 
        // But the previous model only had initialized locations. 
        // Let's iterate the standard types to ensure they appear on the map.
        const visibleTypes = [LocationType.EARTH, LocationType.MOON, LocationType.MARS, LocationType.SPACE_STATION];

        visibleTypes.forEach(type => {
            const id = `loc-node-${type}`;
            let node = this.nodes.get(id);
            if (!node) {
                node = document.createElement("div");
                node.className = "planet-node";

                const visual = document.createElement("div");
                visual.className = "planet-node__visual";
                visual.style.setProperty('--bg-image', `url('${locationAssets[type]}')`);

                const label = document.createElement("div");
                label.className = "planet-node__label";
                label.textContent = locations.get(type) || type;

                node.appendChild(visual);
                node.appendChild(label);

                node.onclick = () => this.onLocationClick(type);

                // Position using CSS variables
                const pos = locationPositions[type];
                node.style.setProperty('--pos-x', `${pos.x * 100}%`);
                node.style.setProperty('--pos-y', `${pos.y * 100}%`);

                this.sceneLayer.appendChild(node);
                this.nodes.set(id, node);
            } else {
                 // Update label if changed
                 const label = node.querySelector(".planet-node__label");
                 if (label) label.textContent = locations.get(type) || type;
            }
        });
    }

    private drawRockets() {
        const session = this.getSession();
        const rect = this.sceneLayer.getBoundingClientRect();

        // Remove old rockets
        const currentIds = new Set(session.rockets.map(r => r["id"])); // id is private but accessible in JS
        // @ts-ignore
        this.rocketNodes.forEach((node, id) => {
            // @ts-ignore
             if (!session.rockets.find(r => r.id === id)) {
                 node.remove();
                 this.rocketNodes.delete(id);
             }
        });

        session.rockets.forEach((rocket: any) => {
             let node = this.rocketNodes.get(rocket.id);
             if (!node) {
                 node = document.createElement("div");
                 node.className = "rocket-node";
                 const visual = document.createElement("div");
                 visual.className = "rocket-node__visual";
                 visual.style.setProperty('--bg-image', `url('${Assets.Rocket}')`);
                 node.appendChild(visual);
                 this.sceneLayer.appendChild(node);
                 this.rocketNodes.set(rocket.id, node);
             }

             if (rocket.destinationId) {
                 // Interpolate position based on time?
                 // The model only has 'estimatedTravelTime'. It doesn't store 'startTime' or 'totalTime'.
                 // We can't smoothly animate without that state.
                 // For now, let's place it at midpoint or just "somewhere".
                 // Improve: Rocket needs 'progress' in model.
                 // Hack: Place it between start and end.
                 // Since we don't have progress, we'll just put it in the middle for now.
                 const startType = rocket.locationId.getType() as LocationType;
                 const endType = rocket.destinationId.getType() as LocationType;
                 const start = locationPositions[startType];
                 const end = locationPositions[endType];

                 // If we had progress (0..1)
                 const progress = 0.5;

                 const x = start.x + (end.x - start.x) * progress;
                 const y = start.y + (end.y - start.y) * progress;

                 node.style.setProperty('--pos-x', `${x * rect.width}px`);
                 node.style.setProperty('--pos-y', `${y * rect.height}px`);

                 // Rotate towards destination
                 const angle = Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI;
                 const visual = node.querySelector(".rocket-node__visual") as HTMLElement;
                 if (visual) visual.style.setProperty('--rotation', `${angle + 45}deg`);
             } else {
                 // Docked
                 const locType = rocket.locationId.getType() as LocationType;
                 const pos = locationPositions[locType];
                 // Offset slightly so it's not inside the planet
                 node.style.setProperty('--pos-x', `${(pos.x * rect.width) + 40}px`);
                 node.style.setProperty('--pos-y', `${(pos.y * rect.height) - 40}px`);
             }
        });
    }
}
