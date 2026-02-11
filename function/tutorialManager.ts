import { modalManager, ModalType } from './modalManager';
import { GameManager } from './app';

export enum TutorialStep {
    WELCOME = 0,
    DASHBOARD = 1,
    RESOURCES = 2,
    COLONY_VIEW = 3,
    MODULES = 4,
    FINISH = 5
}

export interface TutorialAction {
    step: TutorialStep;
    title: string;
    description: string;
    highlightElement?: string; // CSS selector to highlight
    onStart?: () => void;
    onEnd?: () => void;
}

export class TutorialManager {
    private gameManager: GameManager;
    private steps: Map<TutorialStep, TutorialAction>;

    constructor(gameManager: GameManager) {
        this.gameManager = gameManager;
        this.steps = new Map();
        this.initializeSteps();
    }

    private initializeSteps() {
        this.steps.set(TutorialStep.WELCOME, {
            step: TutorialStep.WELCOME,
            title: "Welcome Commander!",
            description: "Welcome to Mars Inc. Your mission is to establish a self-sustaining colony on the Red Planet. Would you like a quick tour of your interface?",
        });

        this.steps.set(TutorialStep.DASHBOARD, {
            step: TutorialStep.DASHBOARD,
            title: "Mission Control",
            description: "This is your main dashboard. From here you can oversee all your operations on Earth and Mars.",
            highlightElement: ".header"
        });

        this.steps.set(TutorialStep.RESOURCES, {
            step: TutorialStep.RESOURCES,
            title: "Resources",
            description: "Keep an eye on your resources. Credits, Fuel, and Food are vital for your expansion.",
            highlightElement: ".resources-bar" // Assuming this class exists
        });
        
        this.steps.set(TutorialStep.COLONY_VIEW, {
            step: TutorialStep.COLONY_VIEW,
            title: "Colony Management",
            description: "Local colony management allows you to construct new buildings and manage production.",
            highlightElement: ".colonies-view" // Assuming this ID or class exists
        });

        this.steps.set(TutorialStep.MODULES, {
            step: TutorialStep.MODULES,
            title: "Production Modules",
            description: "Modules produce resources. Upgrade them to increase efficiency.",
        });

        this.steps.set(TutorialStep.FINISH, {
            step: TutorialStep.FINISH,
            title: "You are Ready!",
            description: "That concludes our tour. Use your resources wisely, expand your infrastructure, and reach for the stars. Good luck!",
        });
    }

    startTutorial() {
        if (this.gameManager.session.tutorialCompleted) return;

        // If not already active, start from beginning
        if (!this.gameManager.session.tutorialActive) {
            this.gameManager.session.tutorialActive = true;
            this.gameManager.session.tutorialStep = TutorialStep.WELCOME;
        }
        
        // Slight delay to ensure UI is ready
        setTimeout(() => this.showCurrentStep(), 500);
    }

    private showCurrentStep() {
        const stepIndex = this.gameManager.session.tutorialStep;
        const stepData = this.steps.get(stepIndex);

        if (stepData) {
            // Check if we need to switch views or perform actions
            if (stepData.onStart) stepData.onStart();

            // Show modal
            modalManager.open(ModalType.TUTORIAL, {
                title: stepData.title,
                text: stepData.description,
                step: stepIndex,
                totalSteps: this.steps.size,
                isStart: stepIndex === TutorialStep.WELCOME,
                isEnd: stepIndex === TutorialStep.FINISH,
                highlightElement: stepData.highlightElement,
                onNext: () => this.nextStep(),
                onSkip: () => this.skipTutorial(),
            });

        } else {
            this.completeTutorial();
        }
    }

    nextStep() {
        const currentStep = this.steps.get(this.gameManager.session.tutorialStep);
        if (currentStep?.onEnd) currentStep.onEnd();

        this.gameManager.session.tutorialStep++;
        
        if (this.steps.has(this.gameManager.session.tutorialStep)) {
            this.showCurrentStep();
        } else {
            this.completeTutorial();
        }
    }

    skipTutorial() {
        this.completeTutorial();
    }

    completeTutorial() {
        this.gameManager.session.tutorialActive = false;
        this.gameManager.session.tutorialCompleted = true;
        modalManager.close(ModalType.TUTORIAL);
        
        // Remove any highlights
        document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
    }
}
