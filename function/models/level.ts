type LevelProperty = {
    name: string;
    value: number;
    increase: number;
}

abstract class LevelSystem {
    private level: number;
    protected MAX_LEVEL = 999;

    constructor(initialLevel: number = 1) {
        this.level = Math.min(initialLevel, this.MAX_LEVEL);
    }

    getLevel(): number {
        return this.level;
    }

    protected setLevel(level: number): void {
        this.level = Math.min(level, this.MAX_LEVEL);
    }

    isMaxLevel(): boolean {
        return this.level >= this.MAX_LEVEL;
    }

    incrementLevel(): void {
        if (!this.isMaxLevel()) {
            this.level++;
            this.onUpgrade();
        }
    }

    getUpgradeCost(): number {
        return Math.floor(50 * Math.pow(1.2, this.level));
    }

    // On upgrade event
    abstract onUpgrade(): void;
    abstract getProperties(): LevelProperty[];
}

export { LevelSystem };
export type { LevelProperty };
