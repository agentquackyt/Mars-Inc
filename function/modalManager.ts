/**
 * Modal Management System
 * Handles opening, closing, and updating modal dialogs
 */

import * as GUI from './gui';
import type { Company, Colony, ProductionModule, InfrastructureModule, Module } from './models/company';
import { ProductionModule as ProductionModuleClass, InfrastructureModule as InfrastructureModuleClass, InfrastructureType, INFRASTRUCTURE_CONFIGS } from './models/company';
import { SpaceConnections, type Rocket } from './models/storage';
import type { LevelSystem } from './models/level';
import type { StorageHolder } from './models/storage';
import { ItemPosition } from './models/good';
import { LocationType } from './models/location';
import type { GameSession } from './models/sessionModel';
import { config } from './models/sessionModel';
import { GoodsRegistry } from './models/goodsRegistry';

export enum ModalType {
    NOTIFICATION = 'notification-view',
    SETTINGS = 'settings-view',
    ROCKET = 'rocket-view',
    COLONY = 'colony-view',
    CARGO_LOAD = 'cargo-load-view',
    MODULE = 'module-view',
    BUILD_MODULE = 'build-module-view',
    ROCKET_FLEET = 'rocket-fleet-view',
    TUTORIAL = 'tutorial-view',
    EXPLORATION = 'exploration-view',
    TRAVEL = 'travel-view'
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
    private onBuildModuleCallback: ((colony: Colony, module: Module, cost: number) => boolean) | null = null;
    private onBuildRocketCallback: ((colony: Colony) => boolean) | null = null;
    private onStartExplorationCallback: ((rocket: Rocket, targetType: LocationType) => boolean) | null = null;
    private onStartTravelCallback: ((rocket: Rocket, targetType: LocationType) => boolean) | null = null;
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
            this.overlay.onclick = () => this.closeTopModal();
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

    private closeTopModal(): void {
        // Find the topmost (highest z-index) visible modal and close only that one
        let topModalType: ModalType | null = null;
        let highestZIndex = -1;

        this.modals.forEach((modal, type) => {
            if (GUI.isVisible(modal)) {
                const computedStyle = window.getComputedStyle(modal);
                const zIndex = parseInt(computedStyle.zIndex, 10);
                if (!isNaN(zIndex) && zIndex > highestZIndex) {
                    highestZIndex = zIndex;
                    topModalType = type;
                }
            }
        });

        // Close only the topmost modal
        if (topModalType) {
            this.close(topModalType);
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

    onBuildModule(callback: (colony: Colony, module: Module, cost: number) => boolean): void {
        this.onBuildModuleCallback = callback;
    }

    onBuildRocket(callback: (colony: Colony) => boolean): void {
        this.onBuildRocketCallback = callback;
    }

    onStartExploration(callback: (rocket: Rocket, targetType: LocationType) => boolean): void {
        this.onStartExplorationCallback = callback;
    }

    onStartTravel(callback: (rocket: Rocket, targetType: LocationType) => boolean): void {
        this.onStartTravelCallback = callback;
    }

    /**
     * Update open modals incrementally if they display time-sensitive data
     */
    updateOpenModalsIncremental(session: any): void {
        // Check if rocket modal is open and update it
        if (this.isOpen(ModalType.ROCKET)) {
            const data = this.modalData.get(ModalType.ROCKET);
            if (data) {
                this.update(ModalType.ROCKET, data);
            }
        }
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
            case ModalType.ROCKET_FLEET:
                this.updateRocketFleetModal(modal, data);
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
            case ModalType.TUTORIAL:
                this.updateTutorialModal(modal, data);
                break;
            case ModalType.EXPLORATION:
                this.updateExplorationModal(modal, data);
                break;
            case ModalType.TRAVEL:
                this.updateTravelModal(modal, data);
                break;
        }
    }

    private createDynamicModal(type: ModalType, data: any): HTMLElement | null {
        switch (type) {
            case ModalType.ROCKET_FLEET:
                return this.createRocketFleetModal(data);

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
            case ModalType.TUTORIAL:
                return this.createTutorialModal(data);
            case ModalType.EXPLORATION:
                return this.createExplorationModal(data);
            case ModalType.TRAVEL:
                return this.createTravelModal(data);
            default:
                return null;
        }
    }

    private createExplorationModal(data: { rocket: Rocket; session: GameSession; selectedTargetType?: LocationType }): HTMLElement {
        const modal = GUI.section({
            classes: ['exploration-view', 'modal']
        });

        const hotbar = GUI.createViewHotbar('Exploration', () => this.close(ModalType.EXPLORATION));
        const content = GUI.createViewContent([], true);
        const actions = GUI.div({ classes: ['modal-actions'] });

        modal.appendChild(hotbar);
        modal.appendChild(content);
        modal.appendChild(actions);

        this.setupCloseButton(modal, ModalType.EXPLORATION);
        this.updateExplorationModal(modal, data);

        return modal;
    }

    private updateExplorationModal(modal: HTMLElement, data: { rocket: Rocket; session: GameSession; selectedTargetType?: LocationType }): void {
        const content = GUI.query<HTMLElement>('.view-content', modal);
        if (!content) return;

        GUI.clearChildren(content);

        const { rocket, session } = data;
        const fromType = rocket.getLocation().getType();

        const colonized = new Set(session.company.colonies.map(c => c.locationId.getType()));
        const possibleTargets = (Object.values(LocationType) as LocationType[])
            .filter(t => t !== LocationType.TRAVELING)
            .filter(t => t !== fromType)
            .filter(t => !colonized.has(t))
            .filter(t => SpaceConnections.some(conn => conn.from === fromType && conn.to === t));

        content.appendChild(GUI.p({
            textContent: `Rocket: ${rocket.name} (from ${rocket.getLocation().name})`,
            classes: ['text-secondary']
        }));

        if (rocket.getDestination()) {
            content.appendChild(GUI.p({
                textContent: 'This rocket is currently traveling.',
                classes: ['text-muted']
            }));
            return;
        }

        if (possibleTargets.length === 0) {
            content.appendChild(GUI.p({
                textContent: 'No valid exploration targets available from this location.',
                classes: ['text-muted']
            }));
            return;
        }

        const selectedTarget = data.selectedTargetType && possibleTargets.some(t => t === data.selectedTargetType)
            ? data.selectedTargetType
            : possibleTargets[0];
        data.selectedTargetType = selectedTarget;

        const selectWrap = GUI.div({ classes: ['row'], styles: { gap: '8px', alignItems: 'center', marginBottom: '16px' } });
        selectWrap.appendChild(GUI.span({ textContent: 'Target:', classes: ['text-secondary'] }));

        const select = document.createElement('select');
        select.classList.add('btn', 'btn-secondary');
        select.id = 'exploration-target-select';
        possibleTargets.forEach(t => {
            const option = document.createElement('option');
            option.value = t;
            option.textContent = t;
            if (t === selectedTarget) option.selected = true;
            select.appendChild(option);
        });
        select.onchange = () => {
            data.selectedTargetType = select.value as LocationType;
            this.update(ModalType.EXPLORATION, data);
        };
        selectWrap.appendChild(select);
        content.appendChild(selectWrap);

        const connection = SpaceConnections.find(conn => conn.from === fromType && conn.to === selectedTarget);
        if (!connection) {
            content.appendChild(GUI.p({ textContent: 'No route available.', classes: ['text-muted'] }));
            return;
        }

        const colonyCount = session.company.colonies.length;
        const exponent = Math.max(0, colonyCount - 1);
        const price = Math.floor(100_000 * Math.pow(4, exponent));
        const fuelUnits = connection.fuelCost * 2;
        const unlockSol = connection.travelTime * 2;

        const tableWrap = GUI.div({ classes: ['lvl-table-wrap'] });
        const statsTable = GUI.table({
            classes: ['lvl-table'],
            children: [
                GUI.row([
                    GUI.span({ textContent: 'Unlock time', classes: ['lvl-property-name'] }),
                    GUI.span({ textContent: `${unlockSol} sol`, classes: ['lvl-property-value'] })
                ]),
                GUI.row([
                    GUI.span({ textContent: 'Fuel required', classes: ['lvl-property-name'] }),
                    GUI.span({ textContent: GUI.formatNumber(fuelUnits), classes: ['lvl-property-value'] })
                ]),
                GUI.row([
                    GUI.span({ textContent: 'Exploration price', classes: ['lvl-property-name'] }),
                    GUI.span({ textContent: GUI.formatMoney(price), classes: ['lvl-property-value'] })
                ])
            ]
        });
        tableWrap.appendChild(statsTable);
        content.appendChild(tableWrap);

        // Check if rocket is at a colony and calculate fuel availability
        const originColony = session.company.colonies.find(c => c.locationId.getId() === rocket.getLocation().getId());
        if (originColony) {
            const fuelItem = originColony.getItemPositions().find(i => i.good.getId() === 3);
            const currentFuel = fuelItem ? fuelItem.quantity : 0;
            const fuelShortfall = Math.max(0, fuelUnits - currentFuel);

            if (fuelShortfall > 0) {
                const fuelGood = GoodsRegistry.get(3)!;
                const buyFuelCost = fuelShortfall * fuelGood.marketBuyPrice;
                const canAfford = session.company.getMoney() >= buyFuelCost;
                const spaceAvailable = originColony.getCapacity() - originColony.getTotalQuantity();
                const canStore = spaceAvailable >= fuelShortfall;
                const canBuy = canAfford && canStore;

                const buyFuelInfo = GUI.div({
                    classes: ['row'],
                    styles: { gap: '8px', marginTop: '12px', alignItems: 'center', flexWrap: 'wrap' }
                });

                const infoText = GUI.span({
                    textContent: `Need ${GUI.formatNumber(fuelShortfall)} more Fuel`,
                    classes: ['text-secondary']
                });
                buyFuelInfo.appendChild(infoText);

                const buyFuelBtn = GUI.button({
                    classes: ['btn', 'btn-small'],
                    textContent: `Buy Fuel (${GUI.formatMoney(buyFuelCost)})`,
                    onClick: () => {
                        if (canBuy) {
                            session.company.deductMoney(buyFuelCost);
                            originColony.addItemPosition(new ItemPosition(fuelGood, fuelShortfall));
                            this.update(ModalType.EXPLORATION, data);
                        }
                    }
                });

                if (!canBuy) {
                    buyFuelBtn.disabled = true;
                    buyFuelBtn.style.opacity = '0.5';
                    buyFuelBtn.style.cursor = 'not-allowed';
                    if (!canAfford) {
                        buyFuelBtn.title = 'Not enough money';
                    } else if (!canStore) {
                        buyFuelBtn.title = `Not enough storage space (need ${fuelShortfall}, have ${spaceAvailable})`;
                    }
                }

                buyFuelInfo.appendChild(buyFuelBtn);
                content.appendChild(buyFuelInfo);
            }
        }

        let actions = GUI.query<HTMLElement>('.modal-actions', modal);
        if (!actions) {
            actions = GUI.div({ classes: ['modal-actions'] });
            modal.appendChild(actions);
        }
        GUI.clearChildren(actions);

        actions.appendChild(GUI.button({
            classes: ['btn', 'btn-secondary'],
            textContent: 'Cancel',
            onClick: () => this.close(ModalType.EXPLORATION)
        }));

        actions.appendChild(GUI.button({
            classes: ['btn', 'btn-small'],
            textContent: 'Launch Exploration',
            onClick: () => {
                if (!this.onStartExplorationCallback) return;
                const ok = this.onStartExplorationCallback(rocket, data.selectedTargetType!);
                if (ok) this.close(ModalType.EXPLORATION);
            }
        }));
    }

    private createTravelModal(data: { rocket: Rocket; session: GameSession; selectedTargetType?: LocationType }): HTMLElement {
        const modal = GUI.section({
            classes: ['travel-view', 'modal']
        });

        const hotbar = GUI.createViewHotbar('Travel', () => this.close(ModalType.TRAVEL));
        const content = GUI.createViewContent([], true);
        const actions = GUI.div({ classes: ['modal-actions'] });

        modal.appendChild(hotbar);
        modal.appendChild(content);
        modal.appendChild(actions);

        this.setupCloseButton(modal, ModalType.TRAVEL);
        this.updateTravelModal(modal, data);

        return modal;
    }

    private updateTravelModal(modal: HTMLElement, data: { rocket: Rocket; session: GameSession; selectedTargetType?: LocationType }): void {
        const content = GUI.query<HTMLElement>('.view-content', modal);
        if (!content) return;

        GUI.clearChildren(content);

        const { rocket, session } = data;
        const fromType = rocket.getLocation().getType();

        // Find all colonized locations that are not the current location
        const colonized = session.company.colonies
            .map(c => c.locationId.getType())
            .filter(t => t !== fromType)
            .filter(t => t !== LocationType.TRAVELING);
        
        // Filter to only those with valid connections
        const possibleTargets = colonized.filter(t =>
            SpaceConnections.some(conn => conn.from === fromType && conn.to === t)
        );

        content.appendChild(GUI.p({
            textContent: `Rocket: ${rocket.name} (from ${rocket.getLocation().name})`,
            classes: ['text-secondary']
        }));

        if (rocket.getDestination()) {
            content.appendChild(GUI.p({
                textContent: 'This rocket is currently traveling.',
                classes: ['text-muted']
            }));
            return;
        }

        if (possibleTargets.length === 0) {
            content.appendChild(GUI.p({
                textContent: 'No valid travel destinations available. Establish more colonies to travel between them.',
                classes: ['text-muted']
            }));
            return;
        }

        const selectedTarget = data.selectedTargetType && possibleTargets.some(t => t === data.selectedTargetType)
            ? data.selectedTargetType
            : possibleTargets[0];
        data.selectedTargetType = selectedTarget;

        const selectWrap = GUI.div({ classes: ['row'], styles: { gap: '8px', alignItems: 'center', marginBottom: '16px' } });
        selectWrap.appendChild(GUI.span({ textContent: 'Destination:', classes: ['text-secondary'] }));

        const select = document.createElement('select');
        select.classList.add('btn', 'btn-secondary');
        select.id = 'travel-target-select';
        possibleTargets.forEach(t => {
            const option = document.createElement('option');
            option.value = t;
            option.textContent = t;
            if (t === selectedTarget) option.selected = true;
            select.appendChild(option);
        });
        select.onchange = () => {
            data.selectedTargetType = select.value as LocationType;
            this.update(ModalType.TRAVEL, data);
        };
        selectWrap.appendChild(select);
        content.appendChild(selectWrap);

        const connection = SpaceConnections.find(conn => conn.from === fromType && conn.to === selectedTarget);
        if (!connection) {
            content.appendChild(GUI.p({ textContent: 'No route available.', classes: ['text-muted'] }));
            return;
        }

        const fuelUnits = connection.fuelCost;
        const travelSol = connection.travelTime;

        const tableWrap = GUI.div({ classes: ['lvl-table-wrap'] });
        const statsTable = GUI.table({
            classes: ['lvl-table'],
            children: [
                GUI.row([
                    GUI.span({ textContent: 'Travel time', classes: ['lvl-property-name'] }),
                    GUI.span({ textContent: `${travelSol} sol`, classes: ['lvl-property-value'] })
                ]),
                GUI.row([
                    GUI.span({ textContent: 'Fuel required', classes: ['lvl-property-name'] }),
                    GUI.span({ textContent: GUI.formatNumber(fuelUnits), classes: ['lvl-property-value'] })
                ])
            ]
        });
        tableWrap.appendChild(statsTable);
        content.appendChild(tableWrap);

        // Check if rocket is at a colony and calculate fuel availability
        const originColony = session.company.colonies.find(c => c.locationId.getId() === rocket.getLocation().getId());
        if (originColony) {
            const fuelItem = originColony.getItemPositions().find(i => i.good.getId() === 3);
            const currentFuel = fuelItem ? fuelItem.quantity : 0;
            const fuelShortfall = Math.max(0, fuelUnits - currentFuel);

            if (fuelShortfall > 0) {
                const fuelGood = GoodsRegistry.get(3)!;
                const buyFuelCost = fuelShortfall * fuelGood.marketBuyPrice;
                const canAfford = session.company.getMoney() >= buyFuelCost;
                const spaceAvailable = originColony.getCapacity() - originColony.getTotalQuantity();
                const canStore = spaceAvailable >= fuelShortfall;
                const canBuy = canAfford && canStore;

                const buyFuelInfo = GUI.div({
                    classes: ['row'],
                    styles: { gap: '8px', marginTop: '12px', alignItems: 'center', flexWrap: 'wrap' }
                });

                const infoText = GUI.span({
                    textContent: `Need ${GUI.formatNumber(fuelShortfall)} more Fuel`,
                    classes: ['text-secondary']
                });
                buyFuelInfo.appendChild(infoText);

                const buyFuelBtn = GUI.button({
                    classes: ['btn', 'btn-small'],
                    textContent: `Buy Fuel (${GUI.formatMoney(buyFuelCost)})`,
                    onClick: () => {
                        if (canBuy) {
                            session.company.deductMoney(buyFuelCost);
                            originColony.addItemPosition(new ItemPosition(fuelGood, fuelShortfall));
                            this.update(ModalType.TRAVEL, data);
                        }
                    }
                });

                if (!canBuy) {
                    buyFuelBtn.disabled = true;
                    buyFuelBtn.style.opacity = '0.5';
                    buyFuelBtn.style.cursor = 'not-allowed';
                    if (!canAfford) {
                        buyFuelBtn.title = 'Not enough money';
                    } else if (!canStore) {
                        buyFuelBtn.title = `Not enough storage space (need ${fuelShortfall}, have ${spaceAvailable})`;
                    }
                }

                buyFuelInfo.appendChild(buyFuelBtn);
                content.appendChild(buyFuelInfo);
            }
        }

        let actions = GUI.query<HTMLElement>('.modal-actions', modal);
        if (!actions) {
            actions = GUI.div({ classes: ['modal-actions'] });
            modal.appendChild(actions);
        }
        GUI.clearChildren(actions);

        actions.appendChild(GUI.button({
            classes: ['btn', 'btn-secondary'],
            textContent: 'Cancel',
            onClick: () => this.close(ModalType.TRAVEL)
        }));

        actions.appendChild(GUI.button({
            classes: ['btn', 'btn-small'],
            textContent: 'Launch Travel',
            onClick: () => {
                if (!this.onStartTravelCallback) return;
                const ok = this.onStartTravelCallback(rocket, data.selectedTargetType!);
                if (ok) this.close(ModalType.TRAVEL);
            }
        }));
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
        const modal = this.createGenericLevelSystemModal(
            'Rocket',
            'Upgrade your rocket to reach new planets and explore the universe!',
            rocket,
            ModalType.ROCKET,
            this.createRocketAdditionalContent(rocket)
        );
        return modal;
    }

    private updateRocketModal(modal: HTMLElement, rocket: Rocket & LevelSystem): void {
        this.updateGenericLevelSystemModal(
            modal,
            rocket,
            'Upgrade your rocket to reach new planets and explore the universe!',
            ModalType.ROCKET,
            this.createRocketAdditionalContent(rocket)
        );
    }

    private createRocketAdditionalContent(rocket: Rocket): HTMLElement[] {
        const content: HTMLElement[] = [];
        const destination = rocket.getDestination();
        
        if (destination) {
            // Rocket is traveling
            const statusDiv = GUI.div({
                classes: ['card'],
                styles: { marginTop: '16px' },
                children: [
                    GUI.p({ 
                        textContent: `Traveling to: ${destination.name}`,
                        styles: { fontWeight: 'bold' }
                    })
                ]
            });

            // Add progress bar if we have initialTravelTime
            if (rocket.initialTravelTime > 0) {
                const progress = Math.max(0, Math.min(100, ((rocket.initialTravelTime - rocket.estimatedTravelTime) / rocket.initialTravelTime) * 100));
                const progressBar = GUI.div({
                    classes: ['sol-progress-bar'],
                    styles: { marginTop: '12px', marginBottom: '8px' },
                    children: [
                        GUI.div({
                            classes: ['sol-progress-fill'],
                            styles: { width: `${progress}%` }
                        })
                    ]
                });
                const remainingSol = rocket.estimatedTravelTime / config.minutesPerSol;
                const progressText = GUI.p({
                    textContent: `${Math.round(progress)}% complete - ${remainingSol.toFixed(1)} sol remaining`,
                    classes: ['text-secondary']
                });
                statusDiv.appendChild(progressBar);
                statusDiv.appendChild(progressText);
            }

            content.push(statusDiv);
        } else {
            // Rocket is docked
            const locationDiv = GUI.div({
                classes: ['card'],
                styles: { marginTop: '16px' },
                children: [
                    GUI.p({ 
                        textContent: `Docked at: ${rocket.getLocation().name}`,
                        classes: ['text-secondary']
                    })
                ]
            });
            content.push(locationDiv);
        }

        return content;
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
                    textContent: `Rocket Storage: ${GUI.formatNumber(rocket.getTotalQuantity(), true)}/${GUI.formatNumber(rocket.getCapacity())}`,
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
                            textContent: `Available: ${GUI.formatNumber(item.quantity, true)}`,
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
                            textContent: `On Rocket: ${GUI.formatNumber(item.quantity, true)}`,
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
                                    textContent: `Location: ${GUI.formatNumber(sourceQty, true)}`,
                                    classes: ['text-secondary']
                                }),
                                GUI.p({
                                    textContent: `Rocket: ${GUI.formatNumber(rocketQty, true)}`,
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

        // Calculate generic module cost base: 1000 * 10^(number of modules)
        const baseModuleCost = 50 * Math.pow(5, modules.length); // Adjusted scaling for better pacing

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
            const infraCost = baseModuleCost * 5; // 5x price for infrastructure "in addition" (assuming multiplier)

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
                        textContent: `Cost: ${GUI.formatMoney(infraCost)}`
                    })
                ],
                styles: {
                    borderColor: config.color,
                    boxShadow: `0 0 10px ${config.color}40`
                }
            });

            infraCard.onclick = () => {
                const newModule = new InfrastructureModuleClass(Number(typeId) as InfrastructureType);
                if (this.onBuildModuleCallback) {
                    if (this.onBuildModuleCallback(colony, newModule, infraCost)) {
                        this.close(ModalType.BUILD_MODULE);
                        // Refresh the colony modal
                        if (this.isOpen(ModalType.COLONY)) {
                            this.update(ModalType.COLONY, colony);
                        }
                    }
                } else {
                    // Fallback if no callback (shouldn't happen in proper setup)
                    if (colony.addColonyModule(newModule)) {
                        this.close(ModalType.BUILD_MODULE);
                        if (this.isOpen(ModalType.COLONY)) {
                            this.update(ModalType.COLONY, colony);
                        }
                    }
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
            const prodCost = baseModuleCost;

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
                        textContent: `Cost: ${GUI.formatMoney(prodCost)}`
                    })
                ],
                styles: {
                    // Slight visual distinction?
                }
            });

            goodCard.onclick = () => {
                const newModule = new ProductionModuleClass(goodId, 1);
                if (this.onBuildModuleCallback) {
                    if (this.onBuildModuleCallback(colony, newModule, prodCost)) {
                        this.close(ModalType.BUILD_MODULE);
                        // Refresh the colony modal
                        if (this.isOpen(ModalType.COLONY)) {
                            this.update(ModalType.COLONY, colony);
                        }
                    }
                } else {
                    if (colony.addColonyModule(newModule)) {
                        this.close(ModalType.BUILD_MODULE);
                        if (this.isOpen(ModalType.COLONY)) {
                            this.update(ModalType.COLONY, colony);
                        }
                    }
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

    /**
     * Create rocket fleet modal
     */
    private createRocketFleetModal(data: { colony: Colony, rocketCount: number }): HTMLElement {
        const modal = GUI.section({
            classes: ['rocket-fleet-view', 'modal']
        });

        const hotbar = GUI.createViewHotbar('Rocket Fleet', () => this.close(ModalType.ROCKET_FLEET));
        const content = GUI.createViewContent([], true);

        modal.appendChild(hotbar);
        modal.appendChild(content);

        this.setupCloseButton(modal, ModalType.ROCKET_FLEET);
        this.updateRocketFleetModal(modal, data);

        return modal;
    }

    /**
     * Update rocket fleet modal
     */
    private updateRocketFleetModal(modal: HTMLElement, data: { colony: Colony, rocketCount: number }): void {
        const { colony, rocketCount } = data;
        const content = GUI.query<HTMLElement>('.view-content', modal);
        if (!content) return;

        GUI.clearChildren(content);

        // Check for Rocket Lab
        const rocketLab = colony.getInfrastructureModules().find(m => m.infrastructureId === InfrastructureType.ROCKET_LAB);

        if (!rocketLab) {
            // No rocket lab - show requirement
            const noLabHeader = GUI.div({
                classes: ['cargo-header'],
                children: [
                    GUI.p({ textContent: 'Rocket Lab Required' }),
                    GUI.p({
                        textContent: 'Build a Rocket Lab infrastructure module to unlock rocket construction.',
                        classes: ['text-secondary']
                    })
                ]
            });
            content.appendChild(noLabHeader);
            return;
        }

        // Fleet Status Header
        const capacity = rocketLab.getBenefitValue();
        const canBuild = rocketCount < capacity;

        const fleetHeader = GUI.div({
            classes: ['cargo-header'],
            children: [
                GUI.p({ textContent: `Location: ${colony.name}` }),
                GUI.p({
                    textContent: `Fleet Size: ${rocketCount}/${capacity} Rockets`,
                    classes: ['text-secondary']
                }),
                GUI.p({ 
                    textContent: `Rocket Lab Level: ${rocketLab.getLevel()}`,
                    classes: ['text-secondary']
                })
            ]
        });
        content.appendChild(fleetHeader);

        // Section title
        const buildTitle = GUI.heading(3, { textContent: 'Build New Rocket' });
        content.appendChild(buildTitle);

        // Capacity Check
        if (!canBuild) {
            const capacityCard = GUI.div({
                classes: ['cargo-good-card', 'cargo-unload'],
                children: [
                    GUI.p({ 
                        textContent: 'Capacity reached. Upgrade the Rocket Lab to build more rockets.',
                        styles: { margin: '0' }
                    })
                ]
            });
            content.appendChild(capacityCard);
        }

        // Cost Calculation
        const scale = Math.pow(1.5, rocketCount);
        const costs = [
            { id: 3, name: 'Fuel', amount: Math.floor(50 * scale), icon: 'oil_barrel' },
            { id: 7, name: 'O2', amount: Math.floor(50 * scale), icon: 'spo2' },
            { id: 4, name: 'Computer', amount: Math.floor(10 * scale), icon: 'memory' },
            { id: 5, name: 'Circuit Board', amount: Math.floor(20 * scale), icon: 'memory' }
        ];

        // Check availability
        let canAfford = true;
        const colonyItems = colony.getItemPositions();

        // Resource requirements in cards
        const requirementsTitle = GUI.p({ 
            textContent: 'Required Resources:',
            styles: { marginBottom: '0.5rem', opacity: '0.8' }
        });
        content.appendChild(requirementsTitle);

        const goodsList = GUI.div({ classes: ['cargo-goods-list'] });

        costs.forEach(cost => {
            const hasItem = colonyItems.find(i => i.good.getId() === cost.id);
            const hasAmount = hasItem ? hasItem.quantity : 0;
            const isEnough = hasAmount >= cost.amount;
            if (!isEnough) canAfford = false;

            const goodCard = GUI.div({
                classes: ['cargo-good-card', 'cargo-merged'],
                children: [
                    GUI.div({
                        classes: ['cargo-good-info'],
                        children: [
                            GUI.div({
                                styles: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
                                children: [
                                    GUI.materialIcon(cost.icon, { 
                                        styles: { fontSize: '20px' }
                                    }),
                                    GUI.heading(4, { 
                                        textContent: cost.name,
                                        styles: { margin: '0' }
                                    })
                                ]
                            })
                        ]
                    }),
                    GUI.div({
                        classes: ['cargo-quantities'],
                        children: [
                            GUI.p({ textContent: `Required: ${GUI.formatNumber(cost.amount)}` }),
                            GUI.p({ 
                                textContent: `Available: ${GUI.formatNumber(hasAmount)}`,
                                classes: [isEnough ? 'text-success' : 'text-danger']
                            })
                        ]
                    })
                ]
            });
            goodsList.appendChild(goodCard);
        });

        content.appendChild(goodsList);

        // Find or create modal-actions container
        let actions = GUI.query<HTMLElement>('.modal-actions', modal);
        if (!actions) {
            actions = GUI.div({ classes: ['modal-actions'] });
            modal.appendChild(actions);
        }
        GUI.clearChildren(actions);

        // Build Button
        const buildBtn = GUI.button({
            classes: ['btn', 'btn-upgrade'],
            children: [
                GUI.materialIcon('rocket_launch', {}),
                GUI.div({
                    classes: ['column'],
                    styles: { alignItems: 'flex-start' },
                    children: [
                        GUI.heading(3, { textContent: 'Build Rocket', styles: { margin: '0' } }),
                        GUI.span({ 
                            textContent: canAfford && canBuild ? 'Construct new rocket' : 'Requirements not met',
                            styles: { fontSize: '0.9em', opacity: '0.8' }
                        })
                    ]
                })
            ],
            onClick: () => {
                if (this.onBuildRocketCallback) {
                    if (this.onBuildRocketCallback(colony)) {
                        this.close(ModalType.ROCKET_FLEET);
                    }
                }
            }
        });

        if (!canBuild || !canAfford) {
            buildBtn.disabled = true;
            buildBtn.classList.add('btn-disabled');
            buildBtn.style.opacity = '0.5';
            buildBtn.style.cursor = 'not-allowed';
        }

        actions.appendChild(buildBtn);
    }

    /* Tutorial Modal */

    private createTutorialModal(data: any): HTMLElement {
        const modal = GUI.section({
            classes: ['modal', 'tutorial-modal'],
            id: 'tutorial-modal'
        });

        const container = GUI.div({ classes: ['tutorial-container'] });
        modal.appendChild(container);

        this.updateTutorialModal(modal, data);

        return modal;
    }

    private updateTutorialModal(modal: HTMLElement, data: any): void {
        const container = modal.querySelector('.tutorial-container');
        if (!container) return;
        
        GUI.clearChildren(container as HTMLElement);

        // Header
        const header = GUI.div({ 
            classes: ['tutorial-header'],
            children: [
                GUI.heading(2, { 
                    textContent: data.title 
                }),
                GUI.div({
                    classes: ['tutorial-step-indicator'],
                    textContent: data.isStart ? '' : `${data.step + 1} / ${data.totalSteps}`
                })
            ]
        });

        // Content
        const content = GUI.div({
            classes: ['tutorial-content'],
            children: [
                GUI.p({ textContent: data.text })
            ]
        });

        // Actions
        const actions = GUI.div({ classes: ['tutorial-actions'] });

        // Skip button (always available except maybe on the last step if we want forced completion, but user requirement says skippable)
        // If it's the start, it's "No thanks". If it's in progress, it's "Skip Tutorial".
        if (data.canSkip !== false) {
            const skipBtn = GUI.button({
                classes: ['btn', 'btn-secondary'],
                textContent: data.isStart ? 'Skip Tour' : 'End Tour',
                onClick: () => {
                   if (data.onSkip) data.onSkip();
                }
            });
            actions.appendChild(skipBtn);
        }

        // Next/Start button
        const nextBtn = GUI.button({
            classes: ['btn', 'btn-small'],
            textContent: data.isStart ? 'Start Tour' : (data.isEnd ? 'Finish' : 'Next'),
            onClick: () => {
                if (data.onNext) data.onNext();
            }
        });
        actions.appendChild(nextBtn);

        container.appendChild(header);
        container.appendChild(content);
        container.appendChild(actions);

        // Handle highlighting
        // First remove all existing highlights
        document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
        
        if (data.highlightElement) {
            const target = document.querySelector(data.highlightElement);
            if (target) {
                target.classList.add('tutorial-highlight');
                // Optional: Scroll to element
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }
}

// Singleton instance
export const modalManager = new ModalManager();
