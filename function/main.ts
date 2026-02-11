/**
 * Main Application Entry Point
 * Integrates all game systems and manages the game loop
 */

import { GameManager } from './app';
import { SaveSystem } from './persistence/saveSystem';
import { hudController } from './hudController';
import { navigationController } from './navigationController';
import { modalManager, ModalType } from './modalManager';
import { GoodsRegistry } from './models/goodsRegistry';
import { Rocket } from './models/storage';
import { InfrastructureType } from './models/company';
import { TutorialManager } from './tutorialManager';
import * as GUI from './gui';

// Initialize core systems
const saveSystem = new SaveSystem();
let gameManager: GameManager;
let tutorialManager: TutorialManager;
let isRunning = false;
let lastUpdateTime = 0;

/**
 * Initialize the game
 */

async function initialize(): Promise<void> {
    try {
        console.log('[Mars Inc] Initializing...');

        // Try to load saved game
        const savedSession = await saveSystem.load();

        if (savedSession) {
            gameManager = new GameManager(savedSession);
            hudController.showSuccess('Game loaded successfully!');
        } else {
            // Create new game
            gameManager = new GameManager();
            hudController.showSuccess('Welcome to Mars Inc!');

            // Save initial state
            await saveSystem.save(gameManager.getSession());
        }

        // Initialize modal manager with goods registry
        modalManager.setGoodsRegistry(GoodsRegistry);

        // Setup tutorial manager
        tutorialManager = new TutorialManager(gameManager);

        // Setup modal upgrade handlers
        setupModalHandlers();

        // Initial UI update (full render)
        updateUI();

        // Start game loop
        isRunning = true;
        lastUpdateTime = Date.now();
        gameLoop();
        
        // Start tutorial if needed (new game or previously active)
        if (!gameManager.session.tutorialCompleted) {
             tutorialManager.startTutorial();
        }

        console.log('[Mars Inc] Ready');

    } catch (error) {
        console.error('[Mars Inc] Initialization failed:', error);
        hudController.showError('Failed to initialize game');
    }
}

/**
 * Setup modal upgrade handlers
 */
function setupModalHandlers(): void {
    // Handle rocket upgrades
    modalManager.onUpgrade(ModalType.ROCKET, (rocket) => {
        const cost = rocket.getUpgradeCost();
        const company = gameManager.getSession().company;

        if (company.deductMoney(cost)) {
            const oldMoney = company.getMoney() + cost;
            rocket.incrementLevel();
            hudController.animateMoneyChange(oldMoney, company.getMoney());
            hudController.showSuccess('Rocket upgraded!');
            modalManager.update(ModalType.ROCKET, rocket);
            updateUI(); // Full UI update after upgrade
        } else {
            hudController.showError('Not enough money!');
        }
    });

    // Handle colony upgrades
    modalManager.onUpgrade(ModalType.COLONY, (colony) => {
        const cost = colony.getUpgradeCost();
        const company = gameManager.getSession().company;

        if (company.deductMoney(cost)) {
            const oldMoney = company.getMoney() + cost;
            colony.incrementLevel();
            hudController.animateMoneyChange(oldMoney, company.getMoney());
            hudController.showSuccess('Colony upgraded!');
            modalManager.update(ModalType.COLONY, colony);
            updateUI(); // Full UI update after upgrade
        } else {
            hudController.showError('Not enough money!');
        }
    });

    // Handle module upgrades (production and infrastructure)
    modalManager.onUpgrade(ModalType.MODULE, (module) => {
        const cost = module.getUpgradeCost();
        const company = gameManager.getSession().company;

        if (company.deductMoney(cost)) {
            const oldMoney = company.getMoney() + cost;
            module.incrementLevel();
            hudController.animateMoneyChange(oldMoney, company.getMoney());
            hudController.showSuccess('Module upgraded!');
            modalManager.updateModalWithStoredData(ModalType.MODULE);
            updateUI(); // Full UI update after upgrade
        } else {
            hudController.showError('Not enough money!');
        }
    });

    // Handle settings actions
    modalManager.onSettingsAction((action, data) => {
        if (action === 'new-game') {
            newGame();
        } else if (action === 'cheat-money') {
            const amount = Number(data);
            const company = gameManager.getSession().company;
            const oldMoney = company.getMoney();
            company.addMoney(amount);
            hudController.animateMoneyChange(oldMoney, company.getMoney());
            hudController.showSuccess(`Cheated ${GUI.formatMoney(amount)}!`);
            updateUI();
        }
    });

    // Handle module building
    modalManager.onBuildModule((colony, module, cost) => {
        const company = gameManager.getSession().company;
        if (company.deductMoney(cost)) {
            const oldMoney = company.getMoney() + cost;
            colony.addColonyModule(module);
            hudController.animateMoneyChange(oldMoney, company.getMoney());
            hudController.showSuccess('Module constructed!');
            updateUI(); // Full UI update
            return true;
        } else {
            hudController.showError('Not enough credits!');
            return false;
        }
    });

    // Handle rocket building
    modalManager.onBuildRocket((colony) => {
         // Check Capacity
        const rocketLab = colony.getInfrastructureModules().find(m => m.getModuleIdentifier() === InfrastructureType.ROCKET_LAB);
        if (!rocketLab) {
            hudController.showError('Rocket Lab required!');
            return false;
        }

        // Count rockets at this colony
        const existingRockets = gameManager.getSession().rockets.filter(r => r.getLocation().getId() === colony.locationId.getId()).length;
        
        const capacity = rocketLab.getBenefitValue();
        if (existingRockets >= capacity) {
             hudController.showError('Limit reached!');
             return false;
        }

        // Exponential cost: Base * 1.5 ^ count
        const scale = Math.pow(1.5, existingRockets);
        
        const costs = [
            { id: 3, name: 'Fuel', amount: Math.floor(50 * scale) },
            { id: 7, name: 'O2', amount: Math.floor(50 * scale) },
            { id: 4, name: 'Computer', amount: Math.floor(10 * scale) },
            { id: 5, name: 'Circuit Board', amount: Math.floor(20 * scale) }
        ];

        // Check resources
        for (const cost of costs) {
            const hasItem = colony.getItemPositions().find(i => i.good.getId() === cost.id);
            if (!hasItem || hasItem.quantity < cost.amount) {
                hudController.showError(`Not enough ${cost.name}!`);
                return false;
            }
        }

        // Deduct resources
        for (const cost of costs) {
            colony.reduceItemQuantity(cost.id, cost.amount);
        }

        // Create Rocket
        const rocketName = `Rocket ${gameManager.getSession().rockets.length + 1}`;
        const newRocket = new Rocket(
            `rkt-${Date.now()}`,
            rocketName,
            60, 
            colony.locationId, 
            1
        );
        gameManager.getSession().addRocket(newRocket);

        hudController.showSuccess('Rocket built!');
        updateUI();
        return true;
    });

    // Handle exploration missions
    modalManager.onStartExploration((rocket, targetType) => {
        const company = gameManager.getSession().company;
        const oldMoney = company.getMoney();

        const result = gameManager.startExploration(rocket, targetType);
        if (!result.ok) {
            hudController.showError(result.message ?? 'Exploration failed');
            return false;
        }

        hudController.animateMoneyChange(oldMoney, company.getMoney());
        hudController.showSuccess('Exploration launched!');
        updateUI();
        return true;
    });

    // Handle travel between colonies
    modalManager.onStartTravel((rocket, targetType) => {
        const success = gameManager.startTravel(rocket, targetType);
        if (!success) {
            hudController.showError('Travel failed');
            return false;
        }

        hudController.showSuccess('Travel started!');
        updateUI();
        return true;
    });
}


/**
 * Main game loop
 */
function gameLoop(): void {
    if (!isRunning) return;

    const now = Date.now();
    const deltaTime = (now - lastUpdateTime) / 1000; // Delta in seconds
    lastUpdateTime = now;

    // Update game state
    const stateChanged = gameManager.tick();

    // Only update UI if state actually changed
    if (stateChanged) {
        updateUIIncremental();
    }

    // Continue loop
    requestAnimationFrame(gameLoop);
}

/**
 * Update all UI elements (full re-render)
 */
function updateUI(): void {
    const session = gameManager.getSession();

    // Update HUD
    hudController.update(session);

    // Update current view (full render)
    navigationController.updateView(session);
}

/**
 * Incremental UI update - only updates values that changed
 */
function updateUIIncremental(): void {
    const session = gameManager.getSession();

    // Only update HUD money counter and Sol display incrementally
    hudController.updateMoneyDisplay(session.company.getMoney());
    hudController.updateSolDisplay(session.getSolData());

    // Update view content incrementally if the view supports it
    navigationController.updateViewIncremental(session);

    // Update open modals if they need refreshing (e.g., rocket modal while traveling)
    modalManager.updateOpenModalsIncremental(session);
}

/**
 * Auto-save system
 */
let autoSaveInterval: number;
function setupAutoSave(): void {
    // Auto-save every 30 seconds
    autoSaveInterval = window.setInterval(async () => {
        try {
            await saveSystem.save(gameManager.getSession());
            console.log('Game auto-saved');
        } catch (error) {
            console.error('Auto-save failed:', error);
        }
    }, 30000);
}

/**
 * Manual save
 */
async function saveGame(): Promise<void> {
    try {
        await saveSystem.save(gameManager.getSession());
        hudController.showSuccess('Game saved!');
    } catch (error) {
        console.error('Save failed:', error);
        hudController.showError('Failed to save game');
    }
}

/**
 * Manual load
 */
async function loadGame(): Promise<void> {
    try {
        const session = await saveSystem.load();
        if (session) {
            gameManager.setSession(session);
            hudController.showSuccess('Game loaded!');
            updateUI();
        } else {
            hudController.showError('No saved game found');
        }
    } catch (error) {
        console.error('Load failed:', error);
        hudController.showError('Failed to load game');
    }
}

/**
 * Reset game
 */
async function newGame(): Promise<void> {
    if (confirm('Start a new game? This will overwrite your current progress.')) {
        gameManager.setSession(gameManager.createNewSession('Mars Inc.'));
        await saveSystem.save(gameManager.getSession());
        hudController.showSuccess('New game started!');
        updateUI();
    }
}

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
        // Ctrl+S or Cmd+S for save
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveGame();
        }

        // Escape to close modals
        if (e.key === 'Escape') {
            modalManager.closeAll();
        }
    });
}

/**
 * Setup visibility change handler for pause
 */
function setupVisibilityHandler(): void {
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            // Tab is hidden - optionally pause game or continue
            console.log('Game continues in background');
        } else {
            // Tab is visible again
            console.log('Game resumed');
        }
    });
}

/**
 * Setup window beforeunload for auto-save
 */
function setupBeforeUnload(): void {
    window.addEventListener('beforeunload', async (e) => {
        try {
            await saveSystem.save(gameManager.getSession());
        } catch (error) {
            console.error('Failed to save on exit:', error);
        }
    });
}

/**
 * Expose debug commands to window (for development)
 */
function setupDebugCommands(): void {
    (window as any).game = {
        addMoney: (amount: number) => {
            gameManager.getSession().company.addMoney(amount);
            hudController.showSuccess(`Added ${GUI.formatMoney(amount)}`);
            updateUI();
        },
        getSession: () => gameManager.getSession(),
        save: saveGame,
        load: loadGame,
        newGame: newGame,
        showModal: (type: ModalType, data?: any) => modalManager.open(type, data),
        switchView: (view: string) => navigationController.switchView(view as any)
    };
    console.log('Debug commands available: window.game');

}

/**
 * Bootstrap the application
 */
async function bootstrap(): Promise<void> {
    console.log('Starting Mars Inc...');

    // Setup systems
    setupKeyboardShortcuts();
    setupVisibilityHandler();
    setupBeforeUnload();
    setupDebugCommands();

    // Initialize game
    await initialize();

    // Setup auto-save
    setupAutoSave();

    console.log('Mars Inc is ready!');
}

// Start the game when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
} else {
    bootstrap();
}

// Export for external use if needed
export {
    gameManager,
    saveGame,
    loadGame,
    newGame,
    updateUI
};
