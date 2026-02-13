/**
 * Configuration
 */

export const CONFIG = {
    // Game timing
    game: {
        minutesPerSol: 0.5,
        autoSaveIntervalMs: 60000, // Auto-save every minute
    },

    // Infrastructure module configuration
    infrastructure: {
        maxLevel: 499,
        
        // Rocket Lab - allows docking more rockets
        rocketLab: {
            workersBase: 1,
            workersPerLevelDivisor: 10,
            workersPerLevelMultiplier: 2,
            benefitLevelDivisor: 10,
            benefitBaseValue: 1,
        },

        // Storeroom - increases storage capacity
        storeroom: {
            baseCapacity: 200,
            capacityScalingFactor: 1.2,
            workersBase: 1,
            workersPerLevelDivisor: 10,
            workersPerLevelMultiplier: 2,
        },
    },

    // Production module configuration
    production: {
        workersPerProductionUnitDivisor: 10,
    },

    // Good/commodity configuration
    goods: {
        defaultBuyPrice: 100,
        defaultSellPrice: 50,
        defaultProductionPerSol: 1,
    },
} as const;
