/**
 * Navigation and View Management System
 * Handles the bottom navigation bar and view switching
 */

import * as GUI from './gui';
import type { GameSession } from './models/sessionModel';
import { CONFIG } from './config';
import type { Company, Colony } from './models/company';
import type { Rocket } from './models/storage';
import { SellRouteState, SpaceConnections } from './models/storage';
import { modalManager, ModalType } from './modalManager';
import { GoodsRegistry } from './models/goodsRegistry';
import { Good, ItemPosition } from './models/good';
import { hudController } from './hudController';
import { LocationType, SpaceLocation, getProductionModifierForLocation } from './models/location';

export enum ViewType {
    HOME = 'home',
    LOCATIONS = 'locations',
    ROCKETS = 'rockets',
    COLONIES = 'colonies',
    BUILDINGS = 'buildings'
}

export interface ViewManager {
    switchView(view: ViewType): void;
    getCurrentView(): ViewType;
    updateView(session: GameSession): void;
}

class NavigationController implements ViewManager {
    private currentView: ViewType = ViewType.HOME;
    private appContainer: HTMLElement;
    private navButtons: Map<ViewType, HTMLButtonElement>;
    private currentSession: GameSession | null = null;

    constructor() {
        this.appContainer = GUI.query<HTMLElement>('#app') || this.createAppContainer();
        this.navButtons = new Map();
        this.initializeNavigation();
    }

    private createAppContainer(): HTMLElement {
        const container = GUI.div({ id: 'app' });
        document.body.appendChild(container);
        return container;
    }

    private initializeNavigation(): void {
        const aside = GUI.query<HTMLElement>('aside.row');
        if (!aside) {
            console.error('Navigation bar not found in DOM');
            return;
        }

        const buttons = GUI.queryAll<HTMLButtonElement>('.btn-icon', aside);

        // Map buttons to views based on their icon
        const iconToView: Record<string, ViewType> = {
            'home': ViewType.HOME,
            'globe_location_pin': ViewType.LOCATIONS,
            'rocket_launch': ViewType.ROCKETS,
            'planet': ViewType.COLONIES,
            'add_business': ViewType.BUILDINGS
        };

        buttons.forEach(button => {
            const icon = GUI.query<HTMLElement>('.material-symbols-rounded', button);
            if (icon) {
                const iconName = icon.textContent?.trim() || '';
                const viewType = iconToView[iconName];

                if (viewType) {
                    this.navButtons.set(viewType, button);
                    button.onclick = () => this.switchView(viewType);
                }
            }
        });

        // Set initial active state
        this.setActiveButton(this.currentView);
    }

    private setActiveButton(view: ViewType): void {
        this.navButtons.forEach((button, buttonView) => {
            if (buttonView === view) {
                GUI.addClass(button, 'active');
            } else {
                GUI.removeClass(button, 'active');
            }
        });
    }

    switchView(view: ViewType): void {
        if (this.currentView === view) return;

        this.currentView = view;
        this.setActiveButton(view);

        // Close all modals when switching views
        modalManager.closeAll();

        // Render the new view with current session
        if (this.currentSession) {
            this.renderCurrentView(this.currentSession);
        }
    }

    getCurrentView(): ViewType {
        return this.currentView;
    }

    updateView(session: GameSession): void {
        this.currentSession = session;
        this.renderCurrentView(session);
    }

    /**
     * Incremental update - only updates values without full re-render
     */
    updateViewIncremental(session: GameSession): void {
        this.currentSession = session;
        // For now, most views don't need constant updates
        // Only the home view might need incremental updates for stats
        if (this.currentView === ViewType.HOME) {
            this.updateHomeViewValues(session);
        } else if (this.currentView === ViewType.BUILDINGS) {
            this.updateMarketValues(session);
        } else if (this.currentView === ViewType.ROCKETS) {
            this.updateRocketsViewIncremental(session);
        }
    }

    /**
     * Update market inventory values without re-rendering
     */
    private updateMarketValues(session: GameSession): void {
        const earthHQ = session.company.colonies.find(c =>
            c.locationId.name === 'Earth HQ' || c.name === 'Earth HQ'
        );

        if (!earthHQ) return;

        // Update inventory text
        const inventoryElements = GUI.queryAll<HTMLElement>('.market-inventory-badge', this.appContainer);
        inventoryElements.forEach(el => {
            const goodId = Number(el.dataset.goodId);
            if (!isNaN(goodId)) {
                const item = earthHQ.getItemPositions().find(ip => ip.good.getId() === goodId);
                const quantity = item ? item.quantity : 0;
                el.textContent = GUI.formatNumber(quantity, true);
            }
        });

        // Update sell buttons state and "All" button price
        const sellButtons = GUI.queryAll<HTMLButtonElement>('.btn-sell', this.appContainer);
        sellButtons.forEach(btn => {
            const goodId = Number(btn.dataset.goodId);
            const sellQty = btn.dataset.sellQty;
            const sellPrice = Number(btn.dataset.sellPrice);

            if (!isNaN(goodId) && !isNaN(sellPrice)) {
                const item = earthHQ.getItemPositions().find(ip => ip.good.getId() === goodId);
                const quantity = item ? item.quantity : 0;

                if (sellQty === 'all') {
                    // Update the "All" button price display with current inventory
                    const totalPrice = sellPrice * Math.floor(quantity);
                    const priceDiv = GUI.query<HTMLElement>('.market-btn-price', btn);
                    if (priceDiv) {
                        priceDiv.textContent = quantity > 0 ? GUI.formatMoney(totalPrice) : GUI.formatMoney(0);
                    }
                    // Disable if quantity is less than 1
                    btn.disabled = quantity < 1;
                } else {
                    const numQty = Number(sellQty);
                    if (!isNaN(numQty)) {
                        btn.disabled = quantity < numQty;
                    }
                }
            }
        });

        // Update the sell all button
        const sellAllButton = GUI.query<HTMLButtonElement>('.sell-all-button', this.appContainer);
        if (sellAllButton) {
            let allGoodsPriceCombined = 0;
            GoodsRegistry.forEach((good) => {
                const item = earthHQ.getItemPositions().find(ip => ip.good.getId() === good.getId());
                if (item && item.quantity > 0) {
                    allGoodsPriceCombined += Math.floor(item.quantity) * good.marketSellPrice;
                }
            });

            // Update the price display in the button
            const costAmountEl = GUI.query<HTMLElement>('.upgrade-cost-amount', sellAllButton);
            if (costAmountEl) {
                costAmountEl.textContent = GUI.formatMoney(allGoodsPriceCombined);
            }

            // Disable button if no goods
            sellAllButton.disabled = allGoodsPriceCombined === 0;
        }
    }

    /**
     * Update rockets view values without re-rendering - updates progress bars and status
     */
    private updateRocketsViewIncremental(session: GameSession): void {
        const rocketCards = GUI.queryAll<HTMLElement>('.rocket-card', this.appContainer);

        session.rockets.forEach((rocket, index) => {
            const card = rocketCards[index];
            if (!card) return;

            const destination = rocket.getDestination();
            const isExploration = session.explorationMissions.some(m => m.rocketId === rocket.getId());

            // Update status text
            const statusEl = GUI.query<HTMLElement>('.rocket-status', card);
            if (statusEl) {
                statusEl.textContent = destination
                    ? (isExploration ? `Exploring ${destination.name}` : `En route to ${destination.name}`)
                    : `Docked at ${rocket.getLocation().name}`;
            }

            // Update or remove progress bar
            const existingProgress = GUI.query<HTMLElement>('.sol-progress-bar', card);
            const rocketInfo = GUI.query<HTMLElement>('.rocket-info', card);

            if (destination && rocket.initialTravelTime > 0 && rocketInfo) {
                const progress = Math.max(0, Math.min(100, ((rocket.initialTravelTime - rocket.estimatedTravelTime) / rocket.initialTravelTime) * 100));
                const remainingSol = rocket.estimatedTravelTime / CONFIG.game.minutesPerSol;


                if (existingProgress) {
                    // Update existing progress bar
                    const progressFill = GUI.query<HTMLElement>('.sol-progress-fill', existingProgress);
                    if (progressFill) {
                        progressFill.style.width = `${progress}%`;
                        progressFill.style.backgroundColor = isExploration ? 'var(--action-upgrade)' : 'var(--text-primary)';
                    }
                    // Update progress text
                    const progressText = existingProgress.nextElementSibling as HTMLElement;
                    if (progressText && progressText.classList.contains('text-secondary')) {
                        progressText.textContent = `${Math.round(progress)}% - ${remainingSol.toFixed(1)} sol remaining`;
                    }
                } else {
                    // Create new progress bar if it doesn't exist
                    const progressBar = GUI.div({
                        classes: ['sol-progress-bar'],
                        styles: { marginTop: '8px', marginBottom: '8px' },
                        children: [
                            GUI.div({
                                classes: ['sol-progress-fill'],
                                styles: {
                                    width: `${progress}%`,
                                    backgroundColor: isExploration ? 'var(--action-upgrade)' : 'var(--text-primary)'
                                }
                            })
                        ]
                    });
                    const remainingSol = rocket.estimatedTravelTime / CONFIG.game.minutesPerSol;
                    const progressText = GUI.p({
                        textContent: `${Math.round(progress)}% - ${remainingSol.toFixed(1)} sol remaining`,
                        classes: ['text-secondary'],
                        styles: { fontSize: '12px', margin: '4px 0' }
                    });

                    // Insert after status text
                    if (statusEl && statusEl.nextSibling) {
                        rocketInfo.insertBefore(progressBar, statusEl.nextSibling);
                        rocketInfo.insertBefore(progressText, progressBar.nextSibling);
                    }
                }
            } else if (existingProgress) {
                // Remove progress bar if rocket is no longer traveling
                const progressText = existingProgress.nextElementSibling;
                existingProgress.remove();
                if (progressText && progressText.classList.contains('text-secondary')) {
                    progressText.remove();
                }
            }
        });
    }

    /**
     * Update only the values in home view without re-rendering
     */
    private updateHomeViewValues(session: GameSession): void {
        // Update stat values if they exist
        const statValues = GUI.queryAll<HTMLElement>('.stat-value', this.appContainer);
        if (statValues.length >= 4) {
            // @ts-ignore - We know these exist based on the order they were created
            statValues[0].textContent = session.rockets.length.toString();
            // @ts-ignore
            statValues[1].textContent = session.company.colonies.length.toString();
            // @ts-ignore
            statValues[2].textContent = GUI.formatMoney(session.company.getMoney());
        }
    }

    private renderCurrentView(session?: GameSession): void {
        if (!session) {
            GUI.clearChildren(this.appContainer);
            return;
        }

        switch (this.currentView) {
            case ViewType.HOME:
                this.renderHomeView(session);
                break;
            case ViewType.LOCATIONS:
                this.renderLocationsView(session);
                break;
            case ViewType.ROCKETS:
                this.renderRocketsView(session);
                break;
            case ViewType.COLONIES:
                this.renderColoniesView(session);
                break;
            case ViewType.BUILDINGS:
                this.renderBuildingsView(session);
                break;
        }
    }

    private renderHomeView(session: GameSession): void {
        GUI.clearChildren(this.appContainer);

        const homeContent = GUI.div({ classes: ['home-view'] });

        // Company overview
        const companyCard = this.createCompanyOverviewCard(session.company);
        homeContent.appendChild(companyCard);

        // Quick stats
        const statsGrid = this.createQuickStatsGrid(session);
        homeContent.appendChild(statsGrid);

        // Recent activity (placeholder)
        const activitySection = GUI.div({
            classes: ['activity-section'],
            children: [
                GUI.heading(3, { textContent: 'Recent Activity' }),
                GUI.p({ textContent: 'No recent activity to display.' })
            ]
        });
        homeContent.appendChild(activitySection);

        this.appContainer.appendChild(homeContent);
    }

    private createCompanyOverviewCard(company: Company): HTMLElement {
        return GUI.div({
            classes: ['card', 'company-card'],
            children: [
                GUI.heading(2, { textContent: company.name }),
                GUI.p({ textContent: `Level ${company.getLevel()}` }),
                GUI.div({
                    classes: ['company-stats'],
                    children: [
                        GUI.div({
                            children: [
                                GUI.span({ textContent: 'Colonies: ', classes: ['stat-label'] }),
                                GUI.span({ textContent: company.colonies.length.toString(), classes: ['stat-value'] })
                            ]
                        })
                    ]
                })
            ]
        });
    }

    private createQuickStatsGrid(session: GameSession): HTMLElement {
        const company = session.company;

        return GUI.div({
            classes: ['stats-grid'],
            children: [
                this.createStatCard('Rockets', session.rockets.length, 'rocket_launch'),
                this.createStatCard('Colonies', company.colonies.length, 'planet'),
                this.createStatCard('Money', GUI.formatMoney(company.getMoney()), 'sell')
            ]
        });
    }

    private createStatCard(label: string, value: string | number, icon: string): HTMLElement {
        return GUI.div({
            classes: ['stat-card'],
            children: [
                GUI.materialIcon(icon, { classes: ['stat-icon'] }),
                GUI.div({
                    classes: ['stat-content'],
                    children: [
                        GUI.span({ textContent: label, classes: ['stat-label'] }),
                        GUI.span({ textContent: value.toString(), classes: ['stat-value'] })
                    ]
                })
            ]
        });
    }

    private renderLocationsView(session: GameSession): void {
        GUI.clearChildren(this.appContainer);

        const locationsView = GUI.div({ classes: ['locations-view'] });
        locationsView.appendChild(GUI.heading(2, { textContent: 'Locations' }));

        // Collect all unique locations with their SpaceLocation objects
        const locationsMap = new Map<string, SpaceLocation>();
        session.company.colonies.forEach(col => {
            if (!locationsMap.has(col.locationId.getId())) {
                locationsMap.set(col.locationId.getId(), col.locationId);
            }
        });

        if (locationsMap.size === 0) {
            locationsView.appendChild(GUI.p({ textContent: 'No locations discovered yet.' }));
        } else {
            const locationsList = GUI.div({ classes: ['locations-list'] });

            locationsMap.forEach(location => {
                // Get colonies at this location
                const coloniesAtLocation = session.company.colonies.filter(
                    col => col.locationId.getId() === location.getId()
                );

                // Get rockets at this location
                const rocketsAtLocation = session.rockets.filter(
                    rocket => rocket.getLocation().getId() === location.getId() && !rocket.getDestination()
                );

                // Get production modifier
                const productionModifier = getProductionModifierForLocation(location.getType());

                // Find available routes from this location
                const availableRoutes = SpaceConnections.filter(
                    conn => conn.from === location.getType()
                ).map(conn => {
                    return {
                        destination: conn.to,
                        travelTime: conn.travelTime,
                        fuelCost: conn.fuelCost
                    };
                });

                const locationCard = GUI.div({ classes: ['location-card'] });

                // Header with icon and name
                const header = GUI.div({
                    classes: ['location-header'],
                    children: [
                        GUI.materialIcon('globe_location_pin', { classes: ['location-icon'] }),
                        GUI.heading(3, { textContent: location.name })
                    ]
                });
                locationCard.appendChild(header);

                // Production modifier info
                const productionInfo = GUI.div({
                    classes: ['location-info'],
                    children: [
                        GUI.span({
                            textContent: `Production: ${productionModifier}x`,
                            classes: ['location-stat']
                        })
                    ]
                });
                locationCard.appendChild(productionInfo);

                // Colonies section
                if (coloniesAtLocation.length > 0) {
                    const coloniesSection = GUI.div({ classes: ['location-section'] });
                    coloniesSection.appendChild(
                        GUI.heading(4, { textContent: `Colonies (${coloniesAtLocation.length})` })
                    );
                    const coloniesList = GUI.createElement('ul', { classes: ['location-list'] });
                    coloniesAtLocation.forEach(colony => {
                        coloniesList.appendChild(
                            GUI.createElement('li', { textContent: `${colony.name} (Level ${colony.getLevel()})` })
                        );
                    });
                    coloniesSection.appendChild(coloniesList);
                    locationCard.appendChild(coloniesSection);
                }

                // Rockets section
                if (rocketsAtLocation.length > 0) {
                    const rocketsSection = GUI.div({ classes: ['location-section'] });
                    rocketsSection.appendChild(
                        GUI.heading(4, { textContent: `Rockets Docked (${rocketsAtLocation.length})` })
                    );
                    const rocketsList = GUI.createElement('ul', { classes: ['location-list'] });
                    rocketsAtLocation.forEach(rocket => {
                        rocketsList.appendChild(
                            GUI.createElement('li', { textContent: rocket.name })
                        );
                    });
                    rocketsSection.appendChild(rocketsList);
                    locationCard.appendChild(rocketsSection);
                }

                // Routes section
                if (availableRoutes.length > 0) {
                    const routesSection = GUI.div({ classes: ['location-section'] });
                    routesSection.appendChild(
                        GUI.heading(4, { textContent: 'Travel Routes' })
                    );
                    const routesList = GUI.createElement('ul', { classes: ['location-list'] });
                    availableRoutes.forEach(route => {
                        routesList.appendChild(
                            GUI.createElement('li', {
                                textContent: `${route.destination} (${route.travelTime} sol, ${GUI.formatNumber(route.fuelCost)} fuel)`
                            })
                        );
                    });
                    routesSection.appendChild(routesList);
                    locationCard.appendChild(routesSection);
                }

                locationsList.appendChild(locationCard);
            });

            locationsView.appendChild(locationsList);
        }

        this.appContainer.appendChild(locationsView);
    }

    private renderRocketsView(session: GameSession): void {
        GUI.clearChildren(this.appContainer);

        const rocketsView = GUI.div({ classes: ['rockets-view'] });
        rocketsView.appendChild(GUI.heading(2, { textContent: 'Rockets' }));

        if (session.rockets.length === 0) {
            rocketsView.appendChild(GUI.p({ textContent: 'No rockets available. Build one to start exploring!' }));
        } else {
            const rocketsList = GUI.div({ classes: ['rockets-list'] });

            // Sort rockets: normal rockets first, sell route rockets last
            const sortedRockets = [...session.rockets].sort((a, b) => {
                if (a.sellRoute === b.sellRoute) return 0;
                return a.sellRoute ? 1 : -1;
            });

            sortedRockets.forEach(rocket => {
                const rocketCard = this.createRocketCard(rocket, session);
                rocketsList.appendChild(rocketCard);
            });

            rocketsView.appendChild(rocketsList);
        }

        this.appContainer.appendChild(rocketsView);
    }

    private createRocketCard(rocket: Rocket, session: GameSession): HTMLElement {
        const destination = rocket.getDestination();
        const isExploration = session.explorationMissions.some(m => m.rocketId === rocket.getId());

        let status = '';
        if (rocket.sellRoute) {
            if (destination) {
                status = rocket.sellRouteState === SellRouteState.TRAVELING_TO_EARTH
                    ? `🔄 Sell Route: To Earth`
                    : `🔄 Sell Route: Returning`;
            } else {
                status = `🔄 Sell Route: At ${rocket.getLocation().name}`;
            }
        } else {
            status = destination
                ? (isExploration ? `Exploring ${destination.name}` : `En route to ${destination.name}`)
                : `Docked at ${rocket.getLocation().name}`;
        }

        const totalQuantity = rocket.getTotalQuantity();
        const capacity = rocket.getCapacity();

        // Check if docked at a colony or warehouse
        const isDocked = !destination;
        const dockedLocation = isDocked ?
            session.company.colonies.find(c => c.locationId.getId() === rocket.getLocation().getId()) : null;

        const buttonContainer = GUI.div({
            classes: ['rocket-actions'],
            styles: { display: 'flex', flexDirection: 'column', gap: '8px' }
        });

        // First row: View and Load Cargo
        const firstRow = GUI.div({
            classes: ['row'],
            styles: { gap: '8px' }
        });

        firstRow.appendChild(GUI.button({
            classes: ['btn', 'btn-small'],
            textContent: 'View',
            onClick: () => modalManager.open(ModalType.ROCKET, rocket)
        }));

        // Add Load Cargo button if docked at a location with storage
        if (dockedLocation) {
            firstRow.appendChild(GUI.button({
                classes: ['btn', 'btn-small', 'btn-accent'],
                textContent: 'Load Cargo',
                onClick: () => {
                    modalManager.open(ModalType.CARGO_LOAD, {
                        rocket,
                        source: dockedLocation,
                        onTransfer: () => {
                            // Update the view after transfer
                            this.updateView(session);
                        }
                    });
                }
            }));
        }

        buttonContainer.appendChild(firstRow);

        // Second row: Sell Route toggle or Travel/Explore (only if docked)
        if (dockedLocation) {
            const secondRow = GUI.div({
                classes: ['row'],
                styles: { gap: '8px' }
            });

            // Show sell route toggle only if not at Earth
            if (dockedLocation.locationId.getType() !== 'Earth') {
                if (rocket.sellRoute) {
                    // Show stop button
                    const stopBtn = GUI.button({
                        classes: ['btn', 'btn-small', 'btn-danger'],
                        textContent: 'Stop Sell Route',
                        onClick: () => {
                            rocket.sellRoute = false;
                            rocket.sellRouteOriginId = null;
                            rocket.sellRouteState = SellRouteState.IDLE;
                            this.updateView(session);
                        }
                    });
                    secondRow.appendChild(stopBtn);
                } else {
                    // Show start button along with other normal buttons
                    const startSellRouteBtn = GUI.button({
                        classes: ['btn', 'btn-small', 'btn-accent'],
                        textContent: 'Start Sell Route',
                        onClick: () => {
                            rocket.sellRoute = true;
                            rocket.sellRouteOriginId = dockedLocation.colonyId;
                            rocket.sellRouteState = SellRouteState.IDLE;

                            // Start immediately
                            const gameManager = (window as any).gameManager;
                            if (gameManager) {
                                gameManager.handleSellRouteAutomation(rocket);
                            }

                            this.updateView(session);
                        }
                    });
                    secondRow.appendChild(startSellRouteBtn);

                    // Show Explore button
                    secondRow.appendChild(GUI.button({
                        classes: ['btn', 'btn-small'],
                        textContent: 'Explore',
                        onClick: () => {
                            modalManager.open(ModalType.EXPLORATION, { rocket, session });
                        }
                    }));
                }
            } else {
                // At Earth, only show Explore button (no sell route)
                secondRow.appendChild(GUI.button({
                    classes: ['btn', 'btn-small'],
                    textContent: 'Explore',
                    onClick: () => {
                        modalManager.open(ModalType.EXPLORATION, { rocket, session });
                    }
                }));
            }

            buttonContainer.appendChild(secondRow);
        }

        const rocketInfoChildren: HTMLElement[] = [
            GUI.heading(3, { textContent: rocket.name }),
            GUI.p({ textContent: status, classes: ['rocket-status'] })
        ];

        // Add progress bar if traveling
        if (destination && rocket.initialTravelTime > 0) {
            const progress = Math.max(0, Math.min(100, ((rocket.initialTravelTime - rocket.estimatedTravelTime) / rocket.initialTravelTime) * 100));

            console.log(`[Create Rocket Card] ${rocket.name}: progress=${progress.toFixed(1)}%, initial=${rocket.initialTravelTime.toFixed(2)}min, remaining=${rocket.estimatedTravelTime.toFixed(2)}min`);

            const progressBar = GUI.div({
                classes: ['sol-progress-bar'],
                styles: { marginTop: '8px', marginBottom: '8px' },
                children: [
                    GUI.div({
                        classes: ['sol-progress-fill'],
                        styles: {
                            width: `${progress}%`,
                            backgroundColor: isExploration ? 'var(--action-upgrade)' : 'var(--text-primary)'
                        }
                    })
                ]
            });
            const remainingSol = rocket.estimatedTravelTime / CONFIG.game.minutesPerSol;
            const progressText = GUI.p({
                textContent: `${Math.round(progress)}% - ${remainingSol.toFixed(1)} sol remaining`,
                classes: ['text-secondary'],
                styles: { fontSize: '12px', margin: '4px 0' }
            });
            rocketInfoChildren.push(progressBar);
            rocketInfoChildren.push(progressText);
        }

        rocketInfoChildren.push(
            GUI.p({
                textContent: `Storage: ${GUI.formatNumber(totalQuantity)}/${GUI.formatNumber(rocket.getCapacity())}`,
                classes: ['rocket-storage']
            }),
            GUI.p({ textContent: `Level ${rocket.getLevel()}`, classes: ['rocket-level'] })
        );

        const card = GUI.div({
            classes: ['rocket-card', 'card'],
            children: [
                GUI.materialIcon('rocket_launch', { classes: ['rocket-icon'] }),
                GUI.div({
                    classes: ['rocket-info'],
                    children: rocketInfoChildren,
                    attributes: { 'data-rocket-id': rocket.getId() }
                }),
                buttonContainer
            ]
        });

        // Add storage details section
        const storageSection = this.createStorageSection(rocket);
        card.appendChild(storageSection);

        return card;
    }

    private renderColoniesView(session: GameSession): void {
        GUI.clearChildren(this.appContainer);

        const coloniesView = GUI.div({ classes: ['colonies-view'] });
        coloniesView.appendChild(GUI.heading(2, { textContent: 'Colonies' }));

        if (session.company.colonies.length === 0) {
            coloniesView.appendChild(GUI.p({ textContent: 'No colonies established yet.' }));
        } else {
            const coloniesList = GUI.div({ classes: ['colonies-list'] });

            session.company.colonies.forEach(colony => {
                const colonyCard = this.createColonyCard(colony, session);
                coloniesList.appendChild(colonyCard);
            });

            coloniesView.appendChild(coloniesList);
        }

        this.appContainer.appendChild(coloniesView);
    }

    private createColonyCard(colony: Colony, session: GameSession): HTMLElement {
        const itemCount = colony.getItemPositions().length;
        const capacity = colony.getCapacity();
        const totalQuantity = colony.getTotalQuantity();

        const card = GUI.div({
            classes: ['colony-card', 'card'],
            children: [
                GUI.materialIcon('planet', { classes: ['colony-icon'] }),
                GUI.div({
                    classes: ['colony-info'],
                    children: [
                        GUI.heading(3, { textContent: colony.name }),
                        GUI.p({ textContent: colony.locationId.name, classes: ['colony-location'] }),
                        GUI.p({
                            textContent: `Storage: ${GUI.formatNumber(totalQuantity)}/${GUI.formatNumber(capacity)}`,
                            classes: ['colony-storage']
                        }),
                        GUI.p({ textContent: `Level ${colony.getLevel()}`, classes: ['colony-level'] })
                    ]
                }),
                GUI.div({
                    classes: ['row'], // Stack buttons or row? "next to the manage button" -> row
                    styles: { gap: '8px' },
                    children: [
                        GUI.button({
                            classes: ['btn', 'btn-small'],
                            textContent: 'Manage',
                            onClick: () => modalManager.open(ModalType.COLONY, colony)
                        }),
                        GUI.button({
                            classes: ['btn', 'btn-small', 'btn-accent'],
                            textContent: 'Rockets',
                            onClick: () => {
                                // Count rockets at this colony
                                const rocketCount = session.rockets.filter(r => {
                                    // Check if rocket is at this location (docked) OR traveling to/from? 
                                    // Usually "fleet at colony" implies based there.
                                    // For now, count rockets currently at location.
                                    return r.getLocation().getId() === colony.locationId.getId();
                                }).length;
                                modalManager.open(ModalType.ROCKET_FLEET, { colony, rocketCount });
                            }
                        })
                    ]
                })
            ]
        });

        console.log(`Colony ${colony.name} has ${itemCount} item types, total quantity ${totalQuantity}, capacity ${capacity}`);
        // Add storage details section
        const storageSection = this.createStorageSection(colony);
        card.appendChild(storageSection);

        return card;
    }

    private renderBuildingsView(session: GameSession): void {
        GUI.clearChildren(this.appContainer);

        const buildingsView = GUI.div({ classes: ['buildings-view', 'market-view'] });
        buildingsView.appendChild(GUI.heading(2, { textContent: 'World Market (Earth)' }));
        buildingsView.appendChild(GUI.p({
            textContent: 'Buy and sell goods at Earth market prices',
            classes: ['market-description']
        }));

        // Calculate total value of all goods in Earth HQ
        const earthHQ = session.company.colonies.find(c =>
            c.locationId.name === 'Earth HQ' || c.name === 'Earth HQ'
        );

        let allGoodsPriceCombined = 0;
        if (earthHQ) {
            GoodsRegistry.forEach((good) => {
                const item = earthHQ.getItemPositions().find(ip => ip.good.getId() === good.getId());
                if (item && item.quantity > 0) {
                    allGoodsPriceCombined += Math.floor(item.quantity) * good.marketSellPrice;
                }
            });
        }

        // Create sell all button
        const sellAllButton = GUI.upgradeButton('Sell all goods', allGoodsPriceCombined, 'sell', () => {
            this.handleSellAllGoods(session);
        });
        sellAllButton.classList.add('sell-all-button');
        sellAllButton.disabled = allGoodsPriceCombined === 0;
        buildingsView.appendChild(sellAllButton);

        const marketGrid = GUI.div({ classes: ['market-grid'] });

        GoodsRegistry.forEach((good, goodId) => {
            const marketCard = this.createMarketGoodCard(good, session);
            marketGrid.appendChild(marketCard);
        });

        buildingsView.appendChild(marketGrid);
        this.appContainer.appendChild(buildingsView);
    }

    private createMarketGoodCard(good: Good, session: GameSession): HTMLElement {
        // Find the Earth HQ colony
        const earthHQ = session.company.colonies.find(c =>
            c.locationId.name === 'Earth HQ' || c.name === 'Earth HQ'
        );

        // Get quantity player has in Earth HQ storage
        let playerQuantity = 0;
        if (earthHQ) {
            const item = earthHQ.getItemPositions().find(ip => ip.good.getId() === good.getId());
            if (item) playerQuantity = item.quantity;
        }

        const iconMap: { [key: string]: string } = {
            'Food': 'dining',
            'Electronics': 'memory',
            'Fuel': 'oil_barrel',
            'ISRU': 'factory'
        };
        // Specific overrides
        if (good.name === 'O2') iconMap['Fuel'] = 'spo2';
        if (good.name === 'Water') iconMap['Food'] = 'water_drop';

        const icon = iconMap[good.category] || 'inventory_2';

        const card = GUI.div({
            classes: ['market-card', 'card'],
            children: [
                // Header: Icon + Name + Inventory Badge
                GUI.div({
                    classes: ['market-header'],
                    children: [
                        GUI.materialIcon(icon, { classes: ['market-icon'] }),
                        GUI.div({
                            classes: ['market-title-group'],
                            children: [
                                GUI.heading(3, { textContent: good.name, classes: ['market-good-name'] }),
                                GUI.span({ textContent: good.category, classes: ['market-good-category'] })
                            ]
                        }),
                        GUI.div({
                            classes: ['market-inventory-badge'],
                            textContent: GUI.formatNumber(playerQuantity, true),
                            dataset: { goodId: String(good.getId()) }
                        })
                    ]
                }),

                // Prices strip
                GUI.div({
                    classes: ['market-prices-compact'],
                    children: [
                        GUI.div({
                            classes: ['price-tag', 'buy'],
                            children: [
                                GUI.span({ textContent: 'B:', classes: [] }),
                                GUI.span({ textContent: GUI.formatMoney(good.marketBuyPrice) })
                            ]
                        }),
                        GUI.div({
                            classes: ['price-tag', 'sell'],
                            children: [
                                GUI.span({ textContent: 'S:', classes: [] }),
                                GUI.span({ textContent: GUI.formatMoney(good.marketSellPrice) })
                            ]
                        })
                    ]
                }),

                // Actions
                GUI.div({
                    classes: ['market-actions-compact'],
                    children: [
                        // Row 1: Buy
                        this.createCompactButton('Buy 1', GUI.formatMoney(good.marketBuyPrice), 'btn-buy', () => this.handleMarketBuy(good, good.marketBuyPrice, 1, session), good),
                        this.createCompactButton('Buy 10', GUI.formatMoney(good.marketBuyPrice * 10), 'btn-buy', () => this.handleMarketBuy(good, good.marketBuyPrice, 10, session), good),

                        // Row 2: Sell
                        this.createCompactSellButton(good, good.marketSellPrice, 1, 'Sell 1', session),
                        this.createCompactSellButton(good, good.marketSellPrice, -1, 'Sell All', session)
                    ]
                })
            ]
        });

        return card;
    }

    private createCompactButton(label: string, subText: string, btnClass: string, onClick: () => void, good: Good): HTMLButtonElement {
        return GUI.button({
            classes: ['btn', btnClass, 'btn-compact'],
            dataset: { goodId: String(good.getId()) },
            children: [
                GUI.div({ classes: ['btn-compact-label'], textContent: label }),
                GUI.div({ classes: ['btn-compact-sub'], textContent: subText })
            ],
            onClick: onClick
        });
    }

    private createCompactSellButton(good: Good, price: number, quantity: number, label: string, session: GameSession): HTMLButtonElement {
        const isAllButton = quantity === -1;

        // Calculate initial price for display (if available)
        let displayPrice = "??";
        if (isAllButton) {
            const earthHQ = session.company.colonies.find(c => c.locationId.name === 'Earth HQ' || c.name === 'Earth HQ');
            if (earthHQ) {
                const item = earthHQ.getItemPositions().find(ip => ip.good.getId() === good.getId());
                const currentQty = item ? Math.floor(item.quantity) : 0;
                displayPrice = currentQty > 0 ? GUI.formatMoney(price * currentQty) : GUI.formatMoney(0);
            }
        } else {
            displayPrice = GUI.formatMoney(price * quantity);
        }

        const button = GUI.button({
            classes: ['btn', 'btn-sell', 'btn-compact'],
            dataset: {
                goodId: String(good.getId()),
                sellQty: isAllButton ? 'all' : String(quantity),
                sellPrice: String(price)
            },
            children: [
                GUI.div({ classes: ['btn-compact-label'], textContent: label }),
                GUI.div({ classes: ['btn-compact-sub', 'market-btn-price'], textContent: displayPrice }) // Keep market-btn-price class for updater
            ],
            onClick: () => {
                if (isAllButton) {
                    const earthHQ = session.company.colonies.find(c => c.locationId.name === 'Earth HQ' || c.name === 'Earth HQ');
                    if (earthHQ) {
                        const item = earthHQ.getItemPositions().find(ip => ip.good.getId() === good.getId());
                        const currentQty = item ? Math.floor(item.quantity) : 0;
                        if (currentQty > 0) {
                            this.handleMarketSell(good, price, currentQty, session);
                        }
                    }
                } else {
                    this.handleMarketSell(good, price, quantity, session);
                }
            }
        });

        // Check if button should be disabled
        const earthHQ = session.company.colonies.find(c =>
            c.locationId.name === 'Earth HQ' || c.name === 'Earth HQ'
        );
        if (earthHQ) {
            const item = earthHQ.getItemPositions().find(ip => ip.good.getId() === good.getId());
            const playerQuantity = item ? item.quantity : 0;

            if (isAllButton) {
                if (playerQuantity < 1) {
                    button.disabled = true;
                }
            } else {
                if (playerQuantity < quantity) {
                    button.disabled = true;
                }
            }
        } else {
            // If no HQ found, disable sell buttons implicitly? 
            // Though current logic allowed them enabled if !isAllButton in some cases if earthHQ was missing earlier in code but here it checks
            // Safest to just keep existing logic structure but extended
        }


        return button;
    }

    private handleMarketBuy(good: Good, price: number, quantity: number, session: GameSession): void {
        const totalCost = price * quantity;

        if (!session.company.deductMoney(totalCost)) {
            alert('Not enough money!');
            return;
        }

        // Find the Earth HQ colony
        const earthHQ = session.company.colonies.find(c =>
            c.locationId.name === 'Earth HQ' || c.name === 'Earth HQ'
        );

        if (!earthHQ) {
            session.company.addMoney(totalCost); // Refund
            alert('Earth HQ not found!');
            return;
        }

        // Check if there's enough storage space
        if (!earthHQ.addItemPosition(new ItemPosition(good, quantity))) {
            session.company.addMoney(totalCost); // Refund
            alert('Not enough storage space at Earth HQ!');
            return;
        }

        hudController.updateMoneyDisplay(session.company.getMoney());
        // Update market values
        this.updateMarketValues(session);
    }

    private handleMarketSell(good: Good, price: number, quantity: number, session: GameSession): void {
        // Find the Earth HQ colony
        const earthHQ = session.company.colonies.find(c =>
            c.locationId.name === 'Earth HQ' || c.name === 'Earth HQ'
        );

        if (!earthHQ) {
            alert('Earth HQ not found!');
            return;
        }

        // Check if we have enough goods to sell
        const item = earthHQ.getItemPositions().find(ip => ip.good.getId() === good.getId());
        if (!item || item.quantity < quantity) {
            alert('Not enough goods to sell!');
            return;
        }

        // Remove goods from Earth HQ
        if (!earthHQ.reduceItemQuantity(good.getId(), quantity)) {
            alert('Error selling goods!');
            return;
        }

        // Remove item if quantity is 0
        if (item.quantity === 0) {
            earthHQ.removeItemPosition(good.getId());
        }

        const totalEarned = price * quantity;
        session.company.addMoney(totalEarned);
        hudController.updateMoneyDisplay(session.company.getMoney());
        // Update market values
        this.updateMarketValues(session);
    }

    private handleSellAllGoods(session: GameSession): void {
        // Find the Earth HQ colony
        const earthHQ = session.company.colonies.find(c =>
            c.locationId.name === 'Earth HQ' || c.name === 'Earth HQ'
        );

        if (!earthHQ) {
            alert('Earth HQ not found!');
            return;
        }

        let totalEarned = 0;
        const itemsToSell: Array<{ good: Good, quantity: number, price: number }> = [];

        // Collect all items to sell
        GoodsRegistry.forEach((good) => {
            const item = earthHQ.getItemPositions().find(ip => ip.good.getId() === good.getId());
            if (item && item.quantity > 0) {
                const quantity = Math.floor(item.quantity);
                itemsToSell.push({ good, quantity, price: good.marketSellPrice });
                totalEarned += quantity * good.marketSellPrice;
            }
        });

        if (itemsToSell.length === 0) {
            alert('No goods to sell!');
            return;
        }

        // Sell all items
        itemsToSell.forEach(({ good, quantity }) => {
            earthHQ.reduceItemQuantity(good.getId(), quantity);
            const item = earthHQ.getItemPositions().find(ip => ip.good.getId() === good.getId());
            if (item && item.quantity === 0) {
                earthHQ.removeItemPosition(good.getId());
            }
        });

        session.company.addMoney(totalEarned);
        hudController.updateMoneyDisplay(session.company.getMoney());
        // Update market values
        this.updateMarketValues(session);
    }

    private createWarehouseCard(warehouse: any): HTMLElement {
        const totalQuantity = warehouse.getTotalQuantity();
        const capacity = warehouse.getCapacity();

        return GUI.div({
            classes: ['warehouse-card', 'card'],
            children: [
                GUI.materialIcon('add_business', { classes: ['warehouse-icon'] }),
                GUI.div({
                    classes: ['warehouse-info'],
                    children: [
                        GUI.heading(3, { textContent: warehouse.name }),
                        GUI.p({ textContent: warehouse.locationId.name, classes: ['warehouse-location'] }),
                        GUI.p({
                            textContent: `Storage: ${GUI.formatNumber(totalQuantity)}/${GUI.formatNumber(capacity)}`,
                            classes: ['warehouse-storage']
                        }),
                        GUI.p({ textContent: `Level ${warehouse.getLevel()}`, classes: ['warehouse-level'] })
                    ]
                })
            ]
        });
    }

    /**
     * Create a storage inventory section showing all items in storage
     */
    private createStorageSection(storageHolder: Rocket | Colony | any): HTMLElement {
        const items = storageHolder.getItemPositions();

        const storageSection = GUI.div({ classes: ['storage-section'] });

        if (items.length === 0) {
            storageSection.appendChild(GUI.p({
                textContent: 'No items in storage',
                classes: ['storage-empty']
            }));
        } else {
            const itemsList = GUI.div({ classes: ['storage-items-list'] });

            items.forEach((itemPosition: any) => {
                const itemCard = GUI.div({
                    classes: ['storage-item'],
                    children: [
                        GUI.span({
                            textContent: itemPosition.good.name,
                            classes: ['storage-item-name']
                        }),
                        GUI.span({
                            textContent: `×${GUI.formatNumber(itemPosition.quantity, true)}`,
                            classes: ['storage-item-quantity']
                        })
                    ]
                });
                itemsList.appendChild(itemCard);
            });

            storageSection.appendChild(itemsList);
        }

        return storageSection;
    }
}

// Singleton instance
export const navigationController = new NavigationController();
