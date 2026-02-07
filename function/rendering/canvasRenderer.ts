import type { GameSession } from "../models/sessionModel";
import { LocationType, SpaceLocation } from "../models/location";
import { Rocket } from "../models/storage";

const locationPositions: Record<LocationType, { x: number; y: number }> = {
    [LocationType.EARTH]: { x: 0.2, y: 0.6 },
    [LocationType.MOON]: { x: 0.35, y: 0.45 },
    [LocationType.MARS]: { x: 0.75, y: 0.4 },
    [LocationType.SPACE_STATION]: { x: 0.55, y: 0.3 },
    [LocationType.TRAVELING]: { x: 0.5, y: 0.5 }
};

export class CanvasRenderer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private getSession: () => GameSession;
    private onObjectClick: (obj: SpaceLocation | Rocket | null) => void;
    private dpr: number = 1;

    constructor(
        canvas: HTMLCanvasElement, 
        getSession: () => GameSession,
        onObjectClick: (obj: SpaceLocation | Rocket | null) => void
    ) {
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas 2D context unavailable");
        this.canvas = canvas;
        this.ctx = ctx;
        this.getSession = getSession;
        this.onObjectClick = onObjectClick;
        this.resize();
        window.addEventListener("resize", () => this.resize());
        
        this.canvas.addEventListener("mousedown", (e) => this.handleInput(e));
    }

    private handleInput(e: MouseEvent) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * this.dpr;
        const y = (e.clientY - rect.top) * this.dpr;
        const width = this.canvas.width;
        const height = this.canvas.height;

        let clicked: SpaceLocation | Rocket | null = null;

        // Check Rockets first (on top)
        const session = this.getSession();
        for (const rocket of session.rockets) {
            const loc = rocket.getDestination() ? LocationType.TRAVELING : rocket.getLocation().getType();
            const pos = locationPositions[loc] ?? { x: 0.5, y: 0.5 };
            const rx = pos.x * width;
            const ry = pos.y * height;
            
            // Simple box collision for rockets (12x12 centered)
            if (Math.abs(x - rx) < 10 && Math.abs(y - ry) < 10) {
                clicked = rocket;
                break;
            }
        }

        // Check Locations if no rocket clicked
        if (!clicked) {
             const locs = this.getLocationMap();
             for (const [type, obj] of locs.entries()) {
                const pos = locationPositions[type];
                if (!pos) continue;
                const lx = pos.x * width;
                const ly = pos.y * height;
                
                // Circle collision, radius 18 + tolerance
                const dist = Math.sqrt(Math.pow(x - lx, 2) + Math.pow(y - ly, 2));
                if (dist < 25) {
                    clicked = obj;
                    break;
                }
             }
        }

        this.onObjectClick(clicked);
    }

    resize() {
        const rect = this.canvas.getBoundingClientRect();
        this.dpr = Math.max(1, window.devicePixelRatio || 1);
        this.canvas.width = Math.floor(rect.width * this.dpr);
        this.canvas.height = Math.floor(rect.height * this.dpr);
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    render() {
        const { width, height } = this.canvas.getBoundingClientRect();
        this.ctx.clearRect(0, 0, width, height);
        this.drawBackground(width, height);
        this.drawLocations(width, height);
        this.drawRockets(width, height);
    }

    private drawBackground(width: number, height: number) {
        const gradient = this.ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, "#0b1020");
        gradient.addColorStop(1, "#1b2238");
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, width, height);
    }

    private getLocationMap(): Map<LocationType, SpaceLocation> {
        const session = this.getSession();
        const map = new Map<LocationType, SpaceLocation>();
        
        // Populate defaults first to ensure we have clickable objects for unvisited places
        // Note: We need actual SpaceLocation objects for the callback.
        // If they aren't in the session, we mock them or use the "Global Location" logic from app.ts.
        // But here we need to return something clickable.
        // Let's use what we have, and constructing temporary ones for visual if needed is tricky 
        // because we passed `obj` back to `onObjectClick`.
        // The safest bet is: existing colonies/warehouses allow full interaction.
        // Empty planets allow "Establish Colony".
        // Use a helper to reconstruct temporary location objects if missing.
        
        [LocationType.EARTH, LocationType.MOON, LocationType.MARS, LocationType.SPACE_STATION].forEach(type => {
             // Try to find real instance
             const real = session.company.colonies.find(c => c.locationId.getType() === type)?.locationId;
             if (real) {
                 map.set(type, real);
             } else {
                 // Temp visual object
                 map.set(type, new SpaceLocation(type, type, `temp-${type}`));
             }
        });
        
        return map;
    }

    private drawLocations(width: number, height: number) {
        const locs = this.getLocationMap();

        locs.forEach((loc, type) => {
            const pos = locationPositions[type];
            if (!pos) return;
            const x = pos.x * width;
            const y = pos.y * height;
            this.ctx.beginPath();
            this.ctx.arc(x, y, 18, 0, Math.PI * 2);
            this.ctx.fillStyle = type === LocationType.MARS ? "#d36b3f" : "#4aa3df";
            this.ctx.fill();
            this.ctx.fillStyle = "#fff";
            this.ctx.font = "14px system-ui";
            this.ctx.fillText(loc.name, x + 22, y + 6);
        });
    }

    private drawRockets(width: number, height: number) {
        const session = this.getSession();
        session.rockets.forEach(rocket => {
            const loc = rocket.getDestination() ? LocationType.TRAVELING : rocket.getLocation().getType();
            const pos = locationPositions[loc] ?? { x: 0.5, y: 0.5 };
            const x = pos.x * width;
            const y = pos.y * height;
            this.ctx.fillStyle = "#f5d76e";
            this.ctx.fillRect(x - 6, y - 6, 12, 12);
        });
    }
}
