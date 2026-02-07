import { Rocket } from "./storage";
import { Company } from "./company";
import { GoodsRegistry } from "./goodsRegistry";
import { SpaceLocation } from "./location";

const config = {
    minutesPerSol: 0.5,
    minutesPerDay: 9
}

class GameSession {
    sessionId: string;
    playerName: string;
    company: Company;
    rockets: Rocket[];
    
    constructor(sessionId: string, playerName: string, company: Company) {
        this.sessionId = sessionId;
        this.playerName = playerName;
        this.company = company;
        this.rockets = [];
    }

    addRocket(rocket: Rocket) {
        this.rockets.push(rocket);
    }

    toData() {
        return {
            sessionId: this.sessionId,
            playerName: this.playerName,
            company: this.company.toData(),
            rockets: this.rockets.map(rocket => rocket.toData())
        };
    }

    static fromData(data: any): GameSession {
        const company = Company.fromData(data.company, GoodsRegistry);
        const session = new GameSession(data.sessionId, data.playerName, company);

        const locations = new Map<string, SpaceLocation>();
        company.colonies.forEach(col => locations.set(col.locationId.getId(), col.locationId));

        session.rockets = (data.rockets ?? []).map((rocketData: any) => Rocket.fromData(rocketData, locations, GoodsRegistry));
        return session;
    }
}

export { GameSession, config };