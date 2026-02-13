import { Rocket } from "./storage";
import { Company } from "./company";
import { GoodsRegistry } from "./goodsRegistry";
import { LocationType, SpaceLocation } from "./location";

// Game configuration is now centralized in config.ts
// Access via CONFIG.game.minutesPerSol

class GameSession {
    sessionId: string;
    playerName: string;
    company: Company;
    rockets: Rocket[];
    totalSolsPassed: number = 0;
    currentSol: number = 1;
    currentSolProgress: number = 0; // 0 to 1
    tutorialActive: boolean = false;
    tutorialStep: number = 0;
    tutorialCompleted: boolean = false;

    explorationMissions: ExplorationMission[] = [];
    
    constructor(sessionId: string, playerName: string, company: Company) {
        this.sessionId = sessionId;
        this.playerName = playerName;
        this.company = company;
        this.rockets = [];
    }

    addRocket(rocket: Rocket) {
        this.rockets.push(rocket);
    }

    updateSolProgress(progress: number) {
        this.currentSolProgress = progress;
    }

    incrementSol() {
        this.totalSolsPassed++;
        this.currentSol++;
        this.currentSolProgress = 0;
        
    }

    getSolData(): { currentSol: number; currentSolProgress: number } {
        return {
            currentSol: this.currentSol,
            currentSolProgress: this.currentSolProgress
        };
    }

    toData() {
        return {
            sessionId: this.sessionId,
            playerName: this.playerName,
            company: this.company.toData(),
            rockets: this.rockets.map(rocket => rocket.toData()),
            totalSolsPassed: this.totalSolsPassed,
            currentSol: this.currentSol,
            currentSolProgress: this.currentSolProgress,
            tutorialActive: this.tutorialActive,
            tutorialStep: this.tutorialStep,
            tutorialCompleted: this.tutorialCompleted,
            explorationMissions: this.explorationMissions
        };
    }

    static fromData(data: any): GameSession {
        const company = Company.fromData(data.company, GoodsRegistry);
        const session = new GameSession(data.sessionId, data.playerName, company);

        const locations = new Map<string, SpaceLocation>();
        company.colonies.forEach(col => locations.set(col.locationId.getId(), col.locationId));

        session.rockets = (data.rockets ?? []).map((rocketData: any) => Rocket.fromData(rocketData, locations, GoodsRegistry));
        session.totalSolsPassed = data.totalSolsPassed ?? 0;
        session.currentSol = data.currentSol ?? 1;
        session.currentSolProgress = data.currentSolProgress ?? 0;
        
        // Restore tutorial state
        session.tutorialActive = data.tutorialActive ?? false;
        session.tutorialStep = data.tutorialStep ?? 0;
        session.tutorialCompleted = data.tutorialCompleted ?? false;

        session.explorationMissions = (data.explorationMissions ?? []).map((m: any) => ({
            rocketId: String(m.rocketId),
            targetType: m.targetType as LocationType
        }));

        return session;
    }
}

type ExplorationMission = {
    rocketId: string;
    targetType: LocationType;
};

export { GameSession };