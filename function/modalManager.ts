/**
 * Modal Management System
 * Handles opening, closing, and updating modal dialogs
 */

import * as GUI from './gui';
import type { Company, Colony, ProductionModule, InfrastructureModule, Module } from './models/company';
import { ProductionModule as ProductionModuleClass, InfrastructureModule as InfrastructureModuleClass, InfrastructureType, INFRASTRUCTURE_CONFIGS } from './models/company';
import type { Rocket } from './models/storage';
import type { LevelSystem } from './models/level';
import type { StorageHolder } from './models/storage';
import { ItemPosition } from './models/good';

export enum ModalType {
    NOTIFICATION = 'notification-view',
    SETTINGS = 'settings-view',
    ROCKET = 'rocket-view',
    COLONY = 'colony-view',
    CARGO_LOAD = 'cargo-load-view',
    MODULE = 'module-view',
    BUILD_MODULE = 'build-module-view'
}

export interface ModalController {
    open(type: ModalType, data?: any): void;
    close(type: ModalType): void;
    closeAll(): void;
    isOpen(type: ModalType): boolean;
    update(type: ModalType, data: any): void;
}

class ModalManager implements ModalController {
    private modals: Map<ModalType, HTMLElement>;
    private onUpgradeCallbacks: Map<ModalType, ((entity: any) => void)[]>;
    private overlay: HTMLElement | null;
    private goodsRegistry: Map<number, any> | null = null;
    private modalData: Map<ModalType, any> = new Map();

    constructor() {
        this.modals = new Map();
        this.onUpgradeCallbacks = new Map();
        this.overlay = null;
        this.initializeModals();
    }

    setGoodsRegistry(registry: Map<number, any>): void {
        this.goodsRegistry = registry;
    }

    /**
     * Update the modal with its stored data (useful after upgrades)
     */
    updateModalWithStoredData(type: ModalType): void {
        const data = this.modalData.get(type);
        if (data) {
            // If modal exists, update it; otherwise reopen it
            if (this.modals.has(type) && this.isOpen(type)) {
                this.update(type, data);
            } else {
                this.open(type, data);
            }
        }
    }

    private initializeModals(): void {
        console.log('[ModalManager] Initializing modals');
        // Find the modal overlay
        this.overlay = GUI.query<HTMLElement>('.modal-overlay');
        
        // Setup overlay click to close modals
        if (this.overlay) {
            this.overlay.onclick = () => this.closeAll();
        }
        
        // Find all modal elements in the DOM
        const notificationModal = GUI.query<HTMLElement>(`.${ModalType.NOTIFICATION}`);
        const settingsModal = GUI.query<HTMLElement>(`.${ModalType.SETTINGS}`);
        
        if (notificationModal) {
            this.modals.set(ModalType.NOTIFICATION, notificationModal);
            this.setupCloseButton(notificationModal, ModalType.NOTIFICATION);
        }
        
        if (settingsModal) {
            this.modals.set(ModalType.SETTINGS, settingsModal);
            this.setupCloseButton(settingsModal, ModalType.SETTINGS);
        }

        // Level view modals will be created dynamically
    }

    private setupCloseButton(modal: HTMLElement, type: ModalType): void {
        const closeBtn = GUI.query<HTMLButtonElement>('.view-hotbar .btn-icon', modal);
        if (closeBtn) {
            closeBtn.onclick = () => this.close(type);
        }
    }

    open(type: ModalType, data?: any): void {
        console.log('[ModalManager] Opening modal:', type, 'data:', data);
        // For MODULE type, always create a new modal (don't cache)
        if (type === ModalType.MODULE) {
            // Remove any existing module modal first
            const existingModal = this.modals.get(type);
            if (existingModal) {
                console.log('[ModalManager] Removing existing module modal');
                existingModal.remove();
                this.modals.delete(type);
                this.modalData.delete(type);
            }
        }

        let modal = this.modals.get(type);

        if (!modal) {
            // Create dynamic modal if it doesn't exist
            const newModal = this.createDynamicModal(type, data);
            if (newModal) {
                modal = newModal;
                this.modals.set(type, modal);
                document.body.appendChild(modal);
                console.log('[ModalManager] Created and appended new modal');
            } else {
                console.warn('[ModalManager] Failed to create modal');
            }
        } else {
            // Update existing modal with new data
            if (data) {
                this.update(type, data);
            }
        }

        // Store the data for this modal type
        if (data) {
            this.modalData.set(type, data);
        }

        if (modal) {
            GUI.show(modal);
            // Show overlay when any modal opens
            if (this.overlay) {
                GUI.show(this.overlay);
                this.updateOverlayZIndex();
                console.log('[ModalManager] Modal and overlay shown');
            }
        }
    }

    close(type: ModalType): void {
        const modal = this.modals.get(type);
        if (modal) {
            GUI.hide(modal);

            // For MODULE type, remove from DOM and modal cache after closing
            // but keep modalData for potential reopening after upgrades
            if (type === ModalType.MODULE) {
                modal.remove();
                this.modals.delete(type);
            }

            // Hide overlay only if no other modals are open
            this.updateOverlayVisibility();
            this.updateOverlayZIndex();
        }
    }

    closeAll(): void {
        this.modals.forEach((modal) => {
            GUI.hide(modal);
        });
        // Hide overlay when all modals are closed
        if (this.overlay) {
            GUI.hide(this.overlay);
        }
    }

    private updateOverlayVisibility(): void {
        // Check if any modal is still open
        let anyModalOpen = false;
        this.modals.forEach((modal) => {
            if (GUI.isVisible(modal)) {
                anyModalOpen = true;
            }
        });

        // Hide overlay if no modals are open
        if (!anyModalOpen && this.overlay) {
            GUI.hide(this.overlay);
        }
    }

    private updateOverlayZIndex(): void {
        if (!this.overlay) return;

        // Find the highest z-index among visible modals
        let highestZIndex = 999; // Default overlay z-index

        this.modals.forEach((modal) => {
            if (GUI.isVisible(modal)) {
                const computedStyle = window.getComputedStyle(modal);
                const zIndex = parseInt(computedStyle.zIndex, 10);
                if (!isNaN(zIndex) && zIndex > highestZIndex) {
                    highestZIndex = zIndex;
                }
            }
        });

        // Set overlay z-index directly (CSS variable approach wasn't working reliably)
        this.overlay.style.zIndex = String(highestZIndex - 1);
    }

    isOpen(type: ModalType): boolean {
        const modal = this.modals.get(type);
        return modal ? GUI.isVisible(modal) : false;
    }

    private settingsActionCallback: ((action: string, data?: any) => void) | null = null;

    onSettingsAction(callback: (action: string, data?: any) => void): void {
        this.settingsActionCallback = callback;
    }

    update(type: ModalType, data: any): void {
        const modal = this.modals.get(type);
        if (!modal) return;

        switch (type) {
            case ModalType.ROCKET:
                this.updateRocketModal(modal, data);
                break;
            case ModalType.COLONY:
                this.updateColonyModal(modal, data);
                break;
            case ModalType.NOTIFICATION:
                this.updateNotificationModal(modal, data);
                break;
            case ModalType.CARGO_LOAD:
                this.updateCargoLoadModal(modal, data);
                break;
            case ModalType.MODULE:
                this.updateModuleModal(modal, data);
                break;
            case ModalType.BUILD_MODULE:
                this.updateBuildModuleModal(modal, data);
                break;
            case ModalType.SETTINGS:
                this.updateSettingsModal(modal, data);
                break;
        }
    }

    private createDynamicModal(type: ModalType, data: any): HTMLElement | null {
        switch (type) {
            case ModalType.ROCKET:
                return this.createRocketModal(data);
            case ModalType.COLONY:
                return this.createColonyModal(data);
            case ModalType.CARGO_LOAD:
                return this.createCargoLoadModal(data);
            case ModalType.MODULE:
                return this.createModuleModal(data);
            case ModalType.BUILD_MODULE:
                return this.createBuildModuleModal(data);
            default:
                return null;
        }
    }

    /**
     * Create a generic LevelSystem modal with properties table and upgrade button
     */
    private createGenericLevelSystemModal(
        title: string,
        description: string,
        entity: LevelSystem,
        modalType: ModalType,
        additionalContent?: HTMLElement[]
    ): HTMLElement {
        const modal = GUI.section({
            classes: ['lvl-view', 'modal', modalType]
        });

        const hotbar = GUI.createViewHotbar(title, () => this.close(modalType));
        const content = GUI.createViewContent([], true);
        const actions = GUI.div({ classes: ['modal-actions'] });

        modal.appendChild(hotbar);
        modal.appendChild(content);
        modal.appendChild(actions);

        this.setupCloseButton(modal, modalType);
        this.updateGenericLevelSystemModal(modal, entity, description, modalType, additionalContent);

        return modal;
    }

    /**
     * Update a generic LevelSystem modal content
     */
    private updateGenericLevelSystemModal(
        modal: HTMLElement,
        entity: LevelSystem,
        description: string,
        modalType: ModalType,
        additionalContent?: HTMLElement[]
    ): void {
        const content = GUI.query<HTMLElement>('.view-content', modal);
        if (!content) return;

        GUI.clearChildren(content);

        // Header with description and level
        const headerRow = GUI.row([
            GUI.p({ textContent: description }),
            GUI.createLevelCard(entity.getLevel(), entity.isMaxLevel())
        ]);
        content.appendChild(headerRow);

        // Stats table from getProperties()
        const properties = entity.getProperties();
        if (properties.length > 0) {
            const tableWrap = GUI.div({ classes: ['lvl-table-wrap'] });
            const statsTable = GUI.table({
                classes: ['lvl-table'],
                children: properties.map(prop =>
                    GUI.createStatRow(prop.name, prop.value, prop.increase)
                )
            });
            tableWrap.appendChild(statsTable);
            content.appendChild(tableWrap);
        }

        // Additional content (e.g., module grid for colonies)
        if (additionalContent) {
            additionalContent.forEach(element => content.appendChild(element));
        }

        // Find or create modal-actions container
        let actions = GUI.query<HTMLElement>('.modal-actions', modal);
        if (!actions) {
            actions = GUI.div({ classes: ['modal-actions'] });
            modal.appendChild(actions);
        }
        GUI.clearChildren(actions);

        // Upgrade button in modal-actions
        const upgradeCost = entity.getUpgradeCost();
        const upgradeBtn = GUI.upgradeButton('Upgrade', upgradeCost, 'sell', () => {
            console.log('[ModalManager] Upgrade button clicked for', modalType);
            this.triggerUpgrade(modalType, entity);
        });

        // Disable button if at max level
        if (entity.isMaxLevel()) {
            upgradeBtn.disabled = true;
            GUI.addClass(upgradeBtn, 'btn-disabled');
        }

        actions.appendChild(upgradeBtn);
    }

    private createRocketModal(rocket: Rocket & LevelSystem): HTMLElement {
        return this.createGenericLevelSystemModal(
            'Rocket',
            'Upgrade your rocket to reach new planets and explore the universe!',
            rocket,
            ModalType.ROCKET
        );
    }

    private updateRocketModal(modal: HTMLElement, rocket: Rocket & LevelSystem): void {
        this.updateGenericLevelSystemModal(
            modal,
            rocket,
            'Upgrade your rocket to reach new planets and explore the universe!',
            ModalType.ROCKET
        );
    }

    private createColonyModal(colony: Colony): HTMLElement {
        const modal = this.createGenericLevelSystemModal(
            colony.name,
            'Upgrade your colony to increase population and resource production!',
            colony,
            ModalType.COLONY,
            this.createColonyAdditionalContent(colony)
        );
        return modal;
    }

    private updateColonyModal(modal: HTMLElement, colony: Colony): void {
        // Update title
        const hotbar = GUI.query<HTMLElement>('.view-hotbar', modal);
        if (hotbar) {
            const title = GUI.query<HTMLElement>('.view-hotbar-title', hotbar);
            if (title) {
                GUI.setText(title, colony.name);
            }
        }

        this.updateGenericLevelSystemModal(
            modal,
            colony,
            'Upgrade your colony to increase population and resource production!',
            ModalType.COLONY,
            this.createColonyAdditionalContent(colony)
        );
    }

    /**
     * Create additional content specific to colony modal (production modules and goods production)
     */
    private createColonyAdditionalContent(colony: Colony): HTMLElement[] {
        const elements: HTMLElement[] = [];

        // Total production section
        const totalProduction = colony.getTotalProductionPerSol();
        if (totalProduction.length > 0) {
            const productionTitle = GUI.heading(3, { textContent: 'Total Production per Sol' });
            elements.push(productionTitle);

            const productionList = GUI.div({ classes: ['production-list'] });
            totalProduction.forEach(({ goodId, quantity }) => {
                const good = this.goodsRegistry?.get(goodId);
                const goodName = good ? good.name : `Good #${goodId}`;
                const productionItem = GUI.div({
                    classes: ['production-item'],
                    children: [
                        GUI.span({ textContent: goodName, classes: ['production-good-name'] }),
                        GUI.span({ textContent: `${GUI.formatNumber(quantity)} t/sol`, classes: ['production-amount'] })
                    ]
                });
                productionList.appendChild(productionItem);
            });
            elements.push(productionList);
        }

        // Infrastructure modules section
        const infrastructureModules = colony.getInfrastructureModules();
        if (infrastructureModules.length > 0) {
            const infraTitle = GUI.heading(3, { textContent: 'Infrastructure Modules' });
            elements.push(infraTitle);

            const infraGrid = GUI.div({ classes: ['module-grid', 'infrastructure-grid'] });
            infrastructureModules.forEach(module => {
                const card = this.createInfrastructureModuleCard(module, colony);
                infraGrid.appendChild(card);
            });
            elements.push(infraGrid);
        }

        // Production modules section
        const moduleTitle = GUI.heading(3, { textContent: 'Production Modules' });
        elements.push(moduleTitle);

        const productionModules = colony.getProductionModules();
        const maxModules = colony.getCompanyModulesAllowed();
        const moduleCards: HTMLElement[] = [];

        // Show existing production modules
        productionModules.forEach(module => {
            const good = this.goodsRegistry?.get(module.goodId);
            const goodName = good ? good.name : `Good #${module.goodId}`;
            const card = this.createProductionModuleCard(module, goodName, colony);
            moduleCards.push(card);
        });

        // Show empty slots as clickable
        const totalModules = colony.getColonyModules().length;
        for (let i = totalModules; i < maxModules; i++) {
            const emptyCard = GUI.div({
                classes: ['module-card', 'empty', 'clickable'],
                children: [
                    GUI.span({
                        classes: ['module-icon', 'material-symbols-rounded'],
                        textContent: 'add'
                    })
                ]
            });

            emptyCard.onclick = () => {
                this.open(ModalType.BUILD_MODULE, { colony });
            };

            moduleCards.push(emptyCard);
        }

        const moduleGrid = GUI.div({
            classes: ['module-grid'],
            children: moduleCards
        });
        elements.push(moduleGrid);

        return elements;
    }

    /**
     * Create a card for a production module
     */
    private createProductionModuleCard(module: ProductionModule, goodName: string, colony: Colony): HTMLElement {
        const card = GUI.div({
            classes: ['module-card', 'filled', 'clickable'],
            children: [
                GUI.span({
                    classes: ['module-icon', 'material-symbols-rounded'],
                    textContent: 'factory'
                }),
                GUI.span({ classes: ['module-label'], textContent: goodName }),
                GUI.span({
                    classes: ['module-level'],
                    textContent: `Lv ${module.getLevel()}`
                })
            ]
        });

        // Make it clickable to open upgrade modal
        console.log('[ModalManager] Card generated for production module:', { goodName, level: module.getLevel() });

        card.onclick = () => {
            console.log('[ModalManager] Production module card clicked');
            this.open(ModalType.MODULE, { module, colony, modalType: ModalType.MODULE });
        };

        return card;
    }

    /**
     * Create a card for an infrastructure module with color coding
     */
    private createInfrastructureModuleCard(module: InfrastructureModule, colony: Colony): HTMLElement {
        const card = GUI.div({
            classes: ['module-card', 'filled', 'clickable', 'infrastructure'],
            children: [
                GUI.span({
                    classes: ['module-icon', 'material-symbols-rounded'],
                    textContent: module.getIcon()
                }),
                GUI.span({ classes: ['module-label'], textContent: module.getModuleName() }),
                GUI.span({
                    classes: ['module-level'],
                    textContent: `Lv ${module.getLevel()}`
                })
            ],
            styles: {
                borderColor: module.getColor(),
                boxShadow: `0 0 10px ${module.getColor()}40`
            }
        });

        // Make it clickable to open upgrade modal
        card.onclick = () => {
            console.log('[ModalManager] Infrastructure module card clicked');
            this.open(ModalType.MODULE, { module, colony, modalType: ModalType.MODULE });
        };

        return card;
    }

    private updateNotificationModal(modal: HTMLElement, data: { message: string; onConfirm?: () => void }): void {
        const content = GUI.query<HTMLElement>('.view-content', modal);
        if (!content) return;

        GUI.clearChildren(content);

        // Add message
        content.appendChild(GUI.p({ textContent: data.message }));

        // Find or create modal-actions container
        let actions = GUI.query<HTMLElement>('.modal-actions', modal);
        if (!actions) {
            actions = GUI.div({ classes: ['modal-actions'] });
            modal.appendChild(actions);
        }
        GUI.clearChildren(actions);

        // Create blue done button in modal-actions
        const doneBtn = GUI.button({
            classes: ['btn', 'btn-secondary'],
            textContent: 'Done',
            onClick: () => {
                data.onConfirm?.();
                this.close(ModalType.NOTIFICATION);
            }
        });
        actions.appendChild(doneBtn);
    }

    private triggerUpgrade(type: ModalType, entity: any): void {
        console.log('[ModalManager] triggerUpgrade called for', type, 'entity:', entity);
        const callbacks = this.onUpgradeCallbacks.get(type);
        console.log('[ModalManager] Found callbacks:', callbacks ? callbacks.length : 0);
        if (callbacks) {
            callbacks.forEach(cb => cb(entity));
        } else {
            console.warn('[ModalManager] No upgrade callbacks registered for', type);
        }
    }

    onUpgrade(type: ModalType, callback: (entity: any) => void): void {
        console.log('[ModalManager] Registering upgrade callback for', type);
        if (!this.onUpgradeCallbacks.has(type)) {
            this.onUpgradeCallbacks.set(type, []);
        }
        this.onUpgradeCallbacks.get(type)?.push(callback);
    }

    showNotification(message: string, onConfirm?: () => void): void {
        this.open(ModalType.NOTIFICATION, { message, onConfirm });
    }

    showSettings(): void {
        this.open(ModalType.SETTINGS, {});
    }

    private createCargoLoadModal(data: { rocket: Rocket; source: StorageHolder & { name: string } }): HTMLElement {
        const modal = GUI.section({
            classes: ['cargo-load-view', 'modal']
        });

        const hotbar = GUI.createViewHotbar('Cargo Operations', () => this.close(ModalType.CARGO_LOAD));
        const content = GUI.createViewContent([], true);
        const actions = GUI.div({ classes: ['modal-actions'] });

        modal.appendChild(hotbar);
        modal.appendChild(content);
        modal.appendChild(actions);

        this.setupCloseButton(modal, ModalType.CARGO_LOAD);
        this.updateCargoLoadModal(modal, data);

        return modal;
    }

    private updateCargoLoadModal(modal: HTMLElement, data: { rocket: Rocket; source: StorageHolder & { name: string }; onTransfer?: () => void }): void {
        const content = GUI.query<HTMLElement>('.view-content', modal);
        if (!content) return;

        GUI.clearChildren(content);

        const { rocket, source, onTransfer } = data;

        // Header with info
        const headerInfo = GUI.div({
            classes: ['cargo-header'],
            children: [
                GUI.p({ textContent: `Location: ${source.name}` }),
                GUI.p({
                    textContent: `Rocket: ${rocket.name}`,
                    classes: ['text-secondary']
                }),
                GUI.p({
                    textContent: `Rocket Storage: ${GUI.formatNumber(rocket.getTotalQuantity())}/${GUI.formatNumber(rocket.getCapacity())}`,
                    classes: ['text-secondary']
                })
            ]
        });
        content.appendChild(headerInfo);

        // Collect all unique goods from both source and rocket
        const allGoods = new Map<number, { good: any; sourceQty: number; rocketQty: number }>();

        source.getItemPositions().forEach(item => {
            allGoods.set(item.good.getId(), {
                good: item.good,
                sourceQty: item.quantity,
                rocketQty: 0
            });
        });

        rocket.getItemPositions().forEach(item => {
            const existing = allGoods.get(item.good.getId());
            if (existing) {
                existing.rocketQty = item.quantity;
            } else {
                allGoods.set(item.good.getId(), {
                    good: item.good,
                    sourceQty: 0,
                    rocketQty: item.quantity
                });
            }
        });

        if (allGoods.size === 0) {
            content.appendChild(GUI.p({
                textContent: 'No goods to transfer.',
                classes: ['text-muted']
            }));
        } else {
            const goodsTitle = GUI.heading(3, { textContent: 'Cargo' });
            content.appendChild(goodsTitle);

            const goodsList = GUI.div({ classes: ['cargo-goods-list'] });

            allGoods.forEach(({ good, sourceQty, rocketQty }) => {
                const goodCard = this.createMergedCargoCard(
                    good,
                    sourceQty,
                    rocketQty,
                    rocket,
                    source,
                    onTransfer
                );
                goodsList.appendChild(goodCard);
            });

            content.appendChild(goodsList);
        }

        // Find or create modal-actions container
        let actions = GUI.query<HTMLElement>('.modal-actions', modal);
        if (!actions) {
            actions = GUI.div({ classes: ['modal-actions'] });
            modal.appendChild(actions);
        }
        GUI.clearChildren(actions);

        // Close button in modal-actions
        const closeBtn = GUI.button({
            classes: ['btn', 'btn-secondary'],
            textContent: 'Done',
            onClick: () => this.close(ModalType.CARGO_LOAD)
        });
        actions.appendChild(closeBtn);
    }

    private createLoadCard(
        item: ItemPosition,
        rocket: Rocket,
        source: StorageHolder,
        onTransfer?: () => void
    ): HTMLElement {
        const card = GUI.div({
            classes: ['cargo-good-card'],
            children: [
                GUI.div({
                    classes: ['cargo-good-info'],
                    children: [
                        GUI.heading(4, { textContent: item.good.name }),
                        GUI.p({
                            textContent: `Available: ${GUI.formatNumber(item.quantity)}`,
                            classes: ['text-secondary']
                        })
                    ]
                })
            ]
        });

        // Transfer controls
        const controls = GUI.div({ classes: ['cargo-controls'] });

        // Transfer amounts: 1, 10, 50, All
        const amounts = [1, 10, 50];
        amounts.forEach(amount => {
            if (amount <= item.quantity) {
                const btn = GUI.button({
                    classes: ['btn', 'btn-small'],
                    textContent: `+${amount}`,
                    onClick: () => {
                        const transferAmount = Math.min(amount, item.quantity);
                        const remaining = rocket.getCapacity() - rocket.getTotalQuantity();
                        const actualAmount = Math.min(transferAmount, remaining);

                        if (actualAmount > 0) {
                            const success = rocket.addItemPosition(new ItemPosition(item.good, actualAmount));
                            if (success && source.reduceItemQuantity(item.good.getId(), actualAmount)) {
                                // Update the modal
                                this.update(ModalType.CARGO_LOAD, { rocket, source, onTransfer });
                                onTransfer?.();
                            }
                        }
                    }
                });
                controls.appendChild(btn);
            }
        });

        card.appendChild(controls);
        return card;
    }

    private createUnloadCard(
        item: ItemPosition,
        rocket: Rocket,
        destination: StorageHolder,
        onTransfer?: () => void
    ): HTMLElement {
        const card = GUI.div({
            classes: ['cargo-good-card', 'cargo-unload'],
            children: [
                GUI.div({
                    classes: ['cargo-good-info'],
                    children: [
                        GUI.heading(4, { textContent: item.good.name }),
                        GUI.p({
                            textContent: `On Rocket: ${GUI.formatNumber(item.quantity)}`,
                            classes: ['text-secondary']
                        })
                    ]
                })
            ]
        });

        // Transfer controls
        const controls = GUI.div({ classes: ['cargo-controls'] });

        // Transfer amounts: 1, 10, 50, All
        const amounts = [1, 10, 50];
        amounts.forEach(amount => {
            if (amount <= item.quantity) {
                const btn = GUI.button({
                    classes: ['btn', 'btn-small'],
                    textContent: `-${amount}`,
                    onClick: () => {
                        const transferAmount = Math.min(amount, item.quantity);
                        const remaining = destination.getCapacity() - destination.getTotalQuantity();
                        const actualAmount = Math.min(transferAmount, remaining);

                        if (actualAmount > 0) {
                            const success = destination.addItemPosition(new ItemPosition(item.good, actualAmount));
                            if (success && rocket.reduceItemQuantity(item.good.getId(), actualAmount)) {
                                // Update the modal
                                this.update(ModalType.CARGO_LOAD, { rocket, source: destination, onTransfer });
                                onTransfer?.();
                            }
                        }
                    }
                });
                controls.appendChild(btn);
            }
        });

        card.appendChild(controls);
        return card;
    }

    private createMergedCargoCard(
        good: any,
        sourceQty: number,
        rocketQty: number,
        rocket: Rocket,
        source: StorageHolder,
        onTransfer?: () => void
    ): HTMLElement {
        const card = GUI.div({
            classes: ['cargo-good-card', 'cargo-merged'],
            children: [
                GUI.div({
                    classes: ['cargo-good-info'],
                    children: [
                        GUI.heading(4, { textContent: good.name }),
                        GUI.div({
                            classes: ['cargo-quantities'],
                            children: [
                                GUI.p({
                                    textContent: `Location: ${GUI.formatNumber(sourceQty)}`,
                                    classes: ['text-secondary']
                                }),
                                GUI.p({
                                    textContent: `Rocket: ${GUI.formatNumber(rocketQty)}`,
                                    classes: ['text-secondary']
                                })
                            ]
                        })
                    ]
                })
            ]
        });

        const controls = GUI.div({ classes: ['cargo-controls-merged'] });

        // Unload controls (from rocket to source)
        if (rocketQty > 0) {
            const unloadSection = GUI.div({ classes: ['cargo-control-section'] });
            const amounts = [1, 10, 50];
            
            amounts.forEach(amount => {
                if (amount <= rocketQty) {
                    const btn = GUI.button({
                        classes: ['btn', 'btn-small', 'btn-unload'],
                        textContent: `-${amount}`,
                        onClick: () => {
                            const transferAmount = Math.min(amount, rocketQty);
                            const remaining = source.getCapacity() - source.getTotalQuantity();
                            const actualAmount = Math.min(transferAmount, remaining);

                            if (actualAmount > 0) {
                                const success = source.addItemPosition(new ItemPosition(good, actualAmount));
                                if (success && rocket.reduceItemQuantity(good.getId(), actualAmount)) {
                                    this.update(ModalType.CARGO_LOAD, { rocket, source, onTransfer });
                                    onTransfer?.();
                                }
                            }
                        }
                    });
                    unloadSection.appendChild(btn);
                }
            });
            
            controls.appendChild(unloadSection);
        }

        // Load controls (from source to rocket)
        if (sourceQty > 0) {
            const loadSection = GUI.div({ classes: ['cargo-control-section'] });
            const amounts = [1, 10, 50];
            
            amounts.forEach(amount => {
                if (amount <= sourceQty) {
                    const btn = GUI.button({
                        classes: ['btn', 'btn-small'],
                        textContent: `+${amount}`,
                        onClick: () => {
                            const transferAmount = Math.min(amount, sourceQty);
                            const remaining = rocket.getCapacity() - rocket.getTotalQuantity();
                            const actualAmount = Math.min(transferAmount, remaining);

                            if (actualAmount > 0) {
                                const success = rocket.addItemPosition(new ItemPosition(good, actualAmount));
                                if (success && source.reduceItemQuantity(good.getId(), actualAmount)) {
                                    this.update(ModalType.CARGO_LOAD, { rocket, source, onTransfer });
                                    onTransfer?.();
                                }
                            }
                        }
                    });
                    loadSection.appendChild(btn);
                }
            });
            
            controls.appendChild(loadSection);
        }

        card.appendChild(controls);
        return card;
    }

    /**
     * Create generic module upgrade modal (works for all Module types)
     */
    private createModuleModal(data: { module: Module; colony: Colony; modalType: ModalType }): HTMLElement {
        const { module, modalType } = data;
        console.log('[ModalManager] Creating module modal:', { moduleName: module.getModuleName(), modalType });
        return this.createGenericLevelSystemModal(
            module.getModuleName(),
            `Upgrade this module to improve its capabilities.`,
            module,
            modalType
        );
    }

    /**
     * Update generic module modal (works for all Module types)
     */
    private updateModuleModal(modal: HTMLElement, data: { module: Module; colony: Colony; modalType: ModalType }): void {
        const { module, colony, modalType } = data;

        // Update title
        const hotbar = GUI.query<HTMLElement>('.view-hotbar', modal);
        if (hotbar) {
            const title = GUI.query<HTMLElement>('.view-hotbar-title', hotbar);
            if (title) {
                GUI.setText(title, module.getModuleName());
            }
        }

        this.updateGenericLevelSystemModal(
            modal,
            module,
            `Upgrade this module to improve its capabilities.`,
            modalType
        );

        // After upgrade, refresh the colony modal if it's open
        if (this.isOpen(ModalType.COLONY)) {
            this.update(ModalType.COLONY, colony);
        }
    }

    /**
     * @deprecated Use createModuleModal instead
     * Create production module upgrade modal
     */
    private createProductionModuleModal(data: { module: ProductionModule; goodName: string; colony: Colony }): HTMLElement {
        return this.createModuleModal({
            module: data.module,
            colony: data.colony,
            modalType: ModalType.MODULE
        });
    }

    /**
     * @deprecated Use updateModuleModal instead
     * Update production module modal
     */
    private updateProductionModuleModal(modal: HTMLElement, data: { module: ProductionModule; goodName: string; colony: Colony }): void {
        this.updateModuleModal(modal, {
            module: data.module,
            colony: data.colony,
            modalType: ModalType.MODULE
        });
    }

    /**
     * @deprecated Use createModuleModal instead
     * Create infrastructure module upgrade modal
     */
    private createInfrastructureModuleModal(data: { module: InfrastructureModule; colony: Colony }): HTMLElement {
        return this.createModuleModal({
            module: data.module,
            colony: data.colony,
            modalType: ModalType.MODULE
        });
    }

    /**
     * @deprecated Use updateModuleModal instead
     * Update infrastructure module modal
     */
    private updateInfrastructureModuleModal(modal: HTMLElement, data: { module: InfrastructureModule; colony: Colony }): void {
        this.updateModuleModal(modal, {
            module: data.module,
            colony: data.colony,
            modalType: ModalType.MODULE
        });
    }

    /**
     * Create build module modal
     */
    private createBuildModuleModal(data: { colony: Colony }): HTMLElement {
        const modal = GUI.section({
            classes: ['build-module-view', 'modal']
        });

        const hotbar = GUI.createViewHotbar('Build Module', () => this.close(ModalType.BUILD_MODULE));
        const content = GUI.createViewContent([], true);

        modal.appendChild(hotbar);
        modal.appendChild(content);

        this.setupCloseButton(modal, ModalType.BUILD_MODULE);
        this.updateBuildModuleModal(modal, data);

        return modal;
    }

    /**
     * Update build module modal
     */
    private updateBuildModuleModal(modal: HTMLElement, data: { colony: Colony }): void {
        const { colony } = data;
        const content = GUI.query<HTMLElement>('.view-content', modal);
        if (!content) return;

        GUI.clearChildren(content);

        // Check if colony has available slots
        const modules = colony.getColonyModules();
        const maxModules = colony.getCompanyModulesAllowed();

        if (modules.length >= maxModules) {
            content.appendChild(GUI.p({
                textContent: 'No available module slots. Upgrade the colony to add more.',
                classes: ['text-muted']
            }));
            return;
        }

        // Infrastructure Modules Section
        const infraTitle = GUI.heading(2, { textContent: 'Infrastructure Modules' });
        content.appendChild(infraTitle);

        const infraDescription = GUI.p({
            textContent: 'Infrastructure modules provide various benefits to your colony such as storage and rocket capacity.',
            classes: ['text-secondary']
        });
        content.appendChild(infraDescription);

        const infraGrid = GUI.div({ classes: ['goods-selection-grid', 'infrastructure-selection-grid'] });

        // Add infrastructure module options
        Object.entries(INFRASTRUCTURE_CONFIGS).forEach(([typeId, config]) => {
            const infraCard = GUI.div({
                classes: ['good-selection-card', 'clickable', 'infrastructure-card'],
                children: [
                    GUI.span({
                        classes: ['good-icon', 'material-symbols-rounded'],
                        textContent: config.icon
                    }),
                    GUI.span({ classes: ['good-name'], textContent: config.name }),
                    GUI.span({
                        classes: ['good-production'],
                        textContent: 'Infrastructure'
                    })
                ],
                styles: {
                    borderColor: config.color,
                    boxShadow: `0 0 10px ${config.color}40`
                }
            });

            infraCard.onclick = () => {
                const newModule = new InfrastructureModuleClass(Number(typeId) as InfrastructureType);
                if (colony.addColonyModule(newModule)) {
                    this.close(ModalType.BUILD_MODULE);
                    // Refresh the colony modal
                    if (this.isOpen(ModalType.COLONY)) {
                        this.update(ModalType.COLONY, colony);
                    }
                    this.showNotification(`Added ${config.name} infrastructure module!`);
                }
            };

            infraGrid.appendChild(infraCard);
        });

        content.appendChild(infraGrid);

        // Production Modules Section
        const prodTitle = GUI.heading(2, {
            textContent: 'Production Modules',
            classes: ['section-title-spaced']
        });
        content.appendChild(prodTitle);

        const prodDescription = GUI.p({
            textContent: 'Production modules generate resources for your colony each sol.',
            classes: ['text-secondary']
        });
        content.appendChild(prodDescription);

        // Display available goods to produce
        if (!this.goodsRegistry || this.goodsRegistry.size === 0) {
            content.appendChild(GUI.p({
                textContent: 'No goods available. Make sure the goods registry is initialized.',
                classes: ['text-muted']
            }));
            return;
        }

        const goodsGrid = GUI.div({ classes: ['goods-selection-grid'] });

        this.goodsRegistry.forEach((good, goodId) => {
            const goodCard = GUI.div({
                classes: ['good-selection-card', 'clickable'],
                children: [
                    GUI.span({
                        classes: ['good-icon', 'material-symbols-rounded'],
                        textContent: good.icon || 'factory'
                    }),
                    GUI.span({ classes: ['good-name'], textContent: good.name }),
                    GUI.span({
                        classes: ['good-production'],
                        textContent: '+1 t/sol base'
                    })
                ]
            });

            goodCard.onclick = () => {
                const newModule = new ProductionModuleClass(goodId, 1);
                if (colony.addColonyModule(newModule)) {
                    this.close(ModalType.BUILD_MODULE);
                    // Refresh the colony modal
                    if (this.isOpen(ModalType.COLONY)) {
                        this.update(ModalType.COLONY, colony);
                    }
                    this.showNotification(`Added ${good.name} production module!`);
                }
            };

            goodsGrid.appendChild(goodCard);
        });

        content.appendChild(goodsGrid);
    }

    /**
     * Update settings modal
     */
    private updateSettingsModal(modal: HTMLElement, data: any): void {
        const content = GUI.query<HTMLElement>('.view-content', modal);
        if (!content) return;
        
        GUI.clearChildren(content);

        // General Settings Section
        const generalTitle = GUI.createElement('h3', { textContent: 'General' });
        content.appendChild(generalTitle);

        const newGameBtn = GUI.createElement('button', {
            classes: ['btn', 'btn-item', 'btn-danger'], // Using btn-item for consistent styling if available, else just btn
            textContent: 'New Game',
            onClick: () => {
                if (confirm('Start a new game? Current progress will be lost.')) {
                    this.settingsActionCallback?.('new-game');
                }
            }
        });
        content.appendChild(newGameBtn);
        
        // Cheats Section
        const cheatsTitle = GUI.createElement('h3', { 
            textContent: 'Cheats / Debug', 
            styles: { marginTop: '20px' } 
        });
        content.appendChild(cheatsTitle);
        
        const cheatsContainer = GUI.div({ 
            classes: ['column'],
            styles: { gap: '10px', marginTop: '10px' }
        });

        // Add 1M Button
        const addMoneyBtn = GUI.createElement('button', {
            classes: ['btn', 'btn-upgrade'],
            children: [
                GUI.createElement('span', { classes: ['material-symbols-rounded'], textContent: 'add' }),
                GUI.div({
                     classes: ['column'],
                     styles: { alignItems: 'flex-start' },
                     children: [
                        GUI.createElement('h3', { textContent: 'Add 1M Credits' }),
                        GUI.createElement('span', { textContent: 'Cheat', styles: { fontSize: '0.8em', opacity: '0.7' } })
                     ]
                })
            ],
            onClick: () => {
                this.settingsActionCallback?.('cheat-money', 1_000_000);
            }
        });
        cheatsContainer.appendChild(addMoneyBtn);

        // Add 10M Button
        const addBigMoneyBtn = GUI.createElement('button', {
            classes: ['btn', 'btn-upgrade'],
            children: [
                 GUI.createElement('span', { classes: ['material-symbols-rounded'], textContent: 'add' }),
                 GUI.div({
                     classes: ['column'],
                     styles: { alignItems: 'flex-start' },
                     children: [
                        GUI.createElement('h3', { textContent: 'Add 10M Credits' }),
                        GUI.createElement('span', { textContent: 'Cheat', styles: { fontSize: '0.8em', opacity: '0.7' } })
                     ]
                })
            ],
            onClick: () => {
                 this.settingsActionCallback?.('cheat-money', 10_000_000);
            }
        });
        cheatsContainer.appendChild(addBigMoneyBtn);

        content.appendChild(cheatsContainer);
    }
}

// Singleton instance
export const modalManager = new ModalManager();
