/**
 * HUD (Heads-Up Display) Controller
 * Manages the header display including money counter and settings button
 */

import * as GUI from './gui';
import type { GameSession } from './models/sessionModel';
import { modalManager } from './modalManager';

export class HUDController {
    private moneyCounter: HTMLElement | null;
    private settingsButton: HTMLButtonElement | null;
    private companyNameDisplay: HTMLElement | null;

    constructor() {
        this.moneyCounter = GUI.query<HTMLElement>('.money-counter');
        this.companyNameDisplay = GUI.query<HTMLElement>('header h2');
        
        // Setup settings button
        const headerButtons = GUI.queryAll<HTMLButtonElement>('header .btn-icon');
        this.settingsButton = headerButtons.find(btn => {
            const icon = GUI.query('.material-symbols-rounded', btn);
            return icon?.textContent?.trim() === 'settings';
        }) || null;

        if (this.settingsButton) {
            this.settingsButton.onclick = () => {
                modalManager.showSettings();
            };
        }

        this.initialize();
    }

    private initialize(): void {
        if (!this.moneyCounter) {
            console.warn('Money counter element not found in DOM');
        }
        
        if (!this.companyNameDisplay) {
            console.warn('Company name display element not found in DOM');
        }
    }

    /**
     * Update the HUD with current game session data
     */
    update(session: GameSession): void {
        this.updateMoneyDisplay(session.company.getMoney());
        this.updateCompanyName(session.company.name);
    }

    /**
     * Update the money counter display
     */
    updateMoneyDisplay(amount: number): void {
        if (this.moneyCounter) {
            const formattedMoney = GUI.formatMoney(amount);
            GUI.setText(this.moneyCounter, formattedMoney);
        }
    }

    /**
     * Update the company name display
     */
    updateCompanyName(name: string): void {
        if (this.companyNameDisplay) {
            GUI.setText(this.companyNameDisplay, name);
        }
    }

    /**
     * Show a temporary notification/toast
     */
    showToast(message: string, duration: number = 2000): void {
        // Check if toast container exists
        let toastContainer = GUI.query<HTMLElement>('.toast-container');
        
        if (!toastContainer) {
            toastContainer = GUI.div({
                classes: ['toast-container']
            });
            document.body.appendChild(toastContainer);
        }

        // Limit number of toasts
        while (toastContainer.children.length >= 5) {
            if (toastContainer.firstChild) {
                toastContainer.removeChild(toastContainer.firstChild);
            }
        }

        const toast = GUI.div({
            classes: ['toast'],
            textContent: message
        });

        toastContainer.appendChild(toast);

        // Show animation
        setTimeout(() => {
            GUI.addClass(toast, 'show');
        }, 10);

        // Hide and remove
        setTimeout(() => {
            GUI.removeClass(toast, 'show');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, duration);
    }

    /**
     * Show an error message
     */
    showError(message: string): void {
        modalManager.showNotification(`Error: ${message}`);
    }

    /**
     * Show a success message
     */
    showSuccess(message: string): void {
        this.showToast(message, 2000);
    }

    /**
     * Animate money change
     */
    animateMoneyChange(oldAmount: number, newAmount: number, duration: number = 500): void {
        if (!this.moneyCounter) return;

        const startTime = Date.now();
        const difference = newAmount - oldAmount;

        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease-out)
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            
            const currentAmount = oldAmount + (difference * easeProgress);
            this.updateMoneyDisplay(Math.round(currentAmount));

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.updateMoneyDisplay(newAmount);
            }
        };

        animate();
    }
}

// Create and export singleton instance
export const hudController = new HUDController();
