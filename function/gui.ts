/**
 * GUI Utility Module
 * Provides type-safe helper functions for creating and manipulating HTML elements
 */

// Type definitions for common HTML elements
export type DivElement = HTMLDivElement;
export type ButtonElement = HTMLButtonElement;
export type SpanElement = HTMLSpanElement;
export type TableElement = HTMLTableElement;
export type SectionElement = HTMLElement;

/**
 * Configuration interface for creating elements
 */
export interface ElementConfig<T extends HTMLElement> {
    classes?: string[];
    id?: string;
    textContent?: string;
    innerHTML?: string;
    attributes?: Record<string, string>;
    styles?: Partial<CSSStyleDeclaration>;
    children?: HTMLElement[];
    onClick?: (event: MouseEvent) => void;
    onInput?: (event: Event) => void;
    dataset?: Record<string, string>;
}

/**
 * Core function to create typed HTML elements with configuration
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    config?: ElementConfig<HTMLElementTagNameMap[K]>
): HTMLElementTagNameMap[K] {
    const element = document.createElement(tag);

    if (!config) return element;

    // Apply classes
    if (config.classes) {
        element.classList.add(...config.classes);
    }

    // Apply ID
    if (config.id) {
        element.id = config.id;
    }

    // Apply text content
    if (config.textContent) {
        element.textContent = config.textContent;
    }

    // Apply inner HTML
    if (config.innerHTML) {
        element.innerHTML = config.innerHTML;
    }

    // Apply attributes
    if (config.attributes) {
        Object.entries(config.attributes).forEach(([key, value]) => {
            element.setAttribute(key, value);
        });
    }

    // Apply styles
    if (config.styles) {
        Object.assign(element.style, config.styles);
    }

    // Apply dataset
    if (config.dataset) {
        Object.entries(config.dataset).forEach(([key, value]) => {
            element.dataset[key] = value;
        });
    }

    // Add children
    if (config.children) {
        config.children.forEach(child => element.appendChild(child));
    }

    // Add event listeners
    if (config.onClick) {
        element.addEventListener('click', config.onClick as EventListener);
    }

    if (config.onInput) {
        element.addEventListener('input', config.onInput as EventListener);
    }

    return element;
}

/**
 * Create a div element
 */
export function div(config?: ElementConfig<HTMLDivElement>): HTMLDivElement {
    return createElement('div', config);
}

/**
 * Create a button element
 */
export function button(config?: ElementConfig<HTMLButtonElement>): HTMLButtonElement {
    return createElement('button', config);
}

/**
 * Create a span element
 */
export function span(config?: ElementConfig<HTMLSpanElement>): HTMLSpanElement {
    return createElement('span', config);
}

/**
 * Create a paragraph element
 */
export function p(config?: ElementConfig<HTMLParagraphElement>): HTMLParagraphElement {
    return createElement('p', config);
}

/**
 * Create a heading element (h1-h6)
 */
export function heading(
    level: 1 | 2 | 3 | 4 | 5 | 6,
    config?: ElementConfig<HTMLHeadingElement>
): HTMLHeadingElement {
    return createElement(`h${level}`, config);
}

/**
 * Create a section element
 */
export function section(config?: ElementConfig<HTMLElement>): HTMLElement {
    return createElement('section', config);
}

/**
 * Create a table element
 */
export function table(config?: ElementConfig<HTMLTableElement>): HTMLTableElement {
    return createElement('table', config);
}

/**
 * Create a table row
 */
export function tr(config?: ElementConfig<HTMLTableRowElement>): HTMLTableRowElement {
    return createElement('tr', config);
}

/**
 * Create a table cell
 */
export function td(config?: ElementConfig<HTMLTableCellElement>): HTMLTableCellElement {
    return createElement('td', config);
}

/**
 * Create a Material Symbols icon span
 */
export function materialIcon(
    iconName: string,
    config?: ElementConfig<HTMLSpanElement>
): HTMLSpanElement {
    const iconConfig: ElementConfig<HTMLSpanElement> = {
        ...config,
        classes: ['material-symbols-rounded', ...(config?.classes || [])],
        textContent: iconName
    };
    return span(iconConfig);
}

/**
 * Create a button with a Material icon
 */
export function iconButton(
    iconName: string,
    onClick?: (event: MouseEvent) => void,
    additionalClasses?: string[]
): HTMLButtonElement {
    const icon = materialIcon(iconName);
    return button({
        classes: ['btn', 'btn-icon', ...(additionalClasses || [])],
        children: [icon],
        onClick
    });
}

/**
 * Create a button with upgrade styling
 */
export function upgradeButton(
    label: string,
    cost: string | number,
    iconName: string = 'sell',
    onClick?: (event: MouseEvent) => void
): HTMLButtonElement {
    const icon = materialIcon(iconName);
    const costDiv = div({
        classes: ['upgrade-cost'],
        children: [
            span({ classes: ['upgrade-cost-label'], textContent: label }),
            span({ classes: ['upgrade-cost-amount'], textContent: `${formatMoney(cost as number)}` })
        ]
    });

    return button({
        classes: ['btn', 'btn-upgrade'],
        children: [icon, costDiv],
        onClick
    });
}

/**
 * Query selector with type safety
 */
export function query<T extends HTMLElement = HTMLElement>(
    selector: string,
    parent: HTMLElement | Document = document
): T | null {
    return parent.querySelector<T>(selector);
}

/**
 * Query selector all with type safety
 */
export function queryAll<T extends HTMLElement = HTMLElement>(
    selector: string,
    parent: HTMLElement | Document = document
): T[] {
    return Array.from(parent.querySelectorAll<T>(selector));
}

/**
 * Add class(es) to element
 */
export function addClass(element: HTMLElement, ...classes: string[]): void {
    element.classList.add(...classes);
}

/**
 * Remove class(es) from element
 */
export function removeClass(element: HTMLElement, ...classes: string[]): void {
    element.classList.remove(...classes);
}

/**
 * Toggle class on element
 */
export function toggleClass(element: HTMLElement, className: string, force?: boolean): void {
    element.classList.toggle(className, force);
}

/**
 * Check if element has class
 */
export function hasClass(element: HTMLElement, className: string): boolean {
    return element.classList.contains(className);
}

/**
 * Clear all children from an element
 */
export function clearChildren(element: HTMLElement): void {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

/**
 * Set text content safely
 */
export function setText(element: HTMLElement, text: string): void {
    element.textContent = text;
}

/**
 * Set HTML content safely (use with caution)
 */
export function setHTML(element: HTMLElement, html: string): void {
    element.innerHTML = html;
}

/**
 * Show an element by removing 'hidden' class
 */
export function show(element: HTMLElement): void {
    removeClass(element, 'hidden');
}

/**
 * Hide an element by adding 'hidden' class
 */
export function hide(element: HTMLElement): void {
    addClass(element, 'hidden');
}

/**
 * Toggle visibility of an element
 */
export function toggleVisibility(element: HTMLElement, visible?: boolean): void {
    if (visible === undefined) {
        toggleClass(element, 'hidden');
    } else {
        toggleClass(element, 'hidden', !visible);
    }
}

/**
 * Check if element is visible (doesn't have 'hidden' class)
 */
export function isVisible(element: HTMLElement): boolean {
    return !hasClass(element, 'hidden');
}

/**
 * Format money value with appropriate suffix
 */
export function formatMoney(amount: number): string {
    const suffixes = ['', 'K', 'M', 'B', 'T'];

    if (amount < 1_000) {
        return `${amount.toFixed(0)}$`;
    }

    let scale = 0;
    let scaledAmount = amount;

    // Scale through suffixes, including beyond T if needed
    while (scaledAmount >= 1_000 && scale < suffixes.length) {
        scaledAmount /= 1_000;
        scale++;
    }

    // Standard suffixes (K, M, B, T)
    if (scale < suffixes.length) {
        return `${scaledAmount.toFixed(1)}${suffixes[scale]}$`;
    }

    // After trillion, use letter notation (aa, ab, ..., zz, aaa, ...)
    // Continue scaling for letter system
    while (scaledAmount >= 1_000) {
        scaledAmount /= 1_000;
        scale++;
    }

    const letterPosition = scale - suffixes.length;
    const letterNotation = getLetterNotation(letterPosition);

    return `${scaledAmount.toFixed(1)}${letterNotation}$`;
}

/**
 * Convert position to letter notation (aa, ab, ..., zz, aaa, ...)
 * Positions 0-675: aa-zz (2 letters)
 * Positions 676+: aaa, aab, ..., zzz, aaaa, ... (3+ letters)
 */
function getLetterNotation(position: number): string {
    if (position < 676) {
        // 2-letter combinations (aa-zz, positions 0-675)
        const first = Math.floor(position / 26);
        const second = position % 26;
        return String.fromCharCode(97 + first) + String.fromCharCode(97 + second);
    }

    // 3+ letter combinations
    const adjusted = position - 676;

    // Determine number of letters needed
    let numLetters = 3;
    let totalCombos = Math.pow(26, 3); // 17576 for 3 letters

    let pos = adjusted;
    while (pos >= totalCombos) {
        pos -= totalCombos;
        numLetters++;
        totalCombos = Math.pow(26, numLetters);
    }

    // Convert to base-26 with numLetters digits
    const result = [];
    for (let i = numLetters - 1; i >= 0; i--) {
        const divisor = Math.pow(26, i);
        const digit = Math.floor(pos / divisor);
        result.push(String.fromCharCode(97 + digit));
        pos %= divisor;
    }

    return result.join('');
}

/**
 * Format large numbers with appropriate suffix (M, B, T, aa, ab, ...)
 * Rounds to 2 significant digits total length
 */
export function formatNumber(value: number, floor: boolean = false): string {
    const suffixes = ['', 'K', 'M', 'B', 'T'];
    value = floor ? Math.floor(value) : value;

    if (value < 1_000) {
        // For values < 1000, show up to 2 significant digits
        if (value >= 10) {
            return value.toFixed(0);
        } else if (value >= 1) {
            return value.toFixed(1);
        } else {
            return value.toFixed(2);
        }
    }

    let scale = 0;
    let scaledAmount = value;

    // Scale through suffixes, including beyond T if needed
    while (scaledAmount >= 1_000 && scale < suffixes.length) {
        scaledAmount /= 1_000;
        scale++;
    }

    // Determine precision based on scaled amount (2 digit total length)
    const precision = scaledAmount >= 10 ? 0 : 1;

    // Standard suffixes (K, M, B, T)
    if (scale < suffixes.length) {
        return `${scaledAmount.toFixed(precision)}${suffixes[scale]}`;
    }

    // After trillion, use letter notation (aa, ab, ..., zz, aaa, ...)
    // Continue scaling for letter system
    while (scaledAmount >= 1_000) {
        scaledAmount /= 1_000;
        scale++;
    }

    const letterPosition = scale - suffixes.length;
    const letterNotation = getLetterNotation(letterPosition);

    // Recalculate precision after additional scaling
    const finalPrecision = scaledAmount >= 10 ? 0 : 1;
    return `${scaledAmount.toFixed(finalPrecision)}${letterNotation}`;
}

/**
 * Create a level view card
 */
export function createLevelCard(level: number, isMaxLevel: boolean = false): HTMLDivElement {
    return div({
        classes: ['lvl-view-card'],
        children: [
            span({ classes: ['lvl-label'], textContent: 'Level' }),
            span({ classes: ['lvl-number'], textContent: isMaxLevel ? 'MAX' : level.toString() })
        ]
    });
}

/**
 * Create a table row for level view stats
 */
export function createStatRow(
    label: string,
    currentValue: string | number,
    upgradeModifier?: string | number
): HTMLTableRowElement {
    const cells: HTMLTableCellElement[] = [
        td({ textContent: label })
    ];

    if (upgradeModifier !== undefined && upgradeModifier !== 0) {
        const valueSpan = span({
            textContent: `${typeof currentValue === 'number' ? formatNumber(currentValue) : currentValue} `,
        });

        const modifierSpan = span({
            classes: ['lvl-upgrade-modifier'],
            textContent: `+${typeof upgradeModifier === 'number' ? formatNumber(upgradeModifier) : upgradeModifier}`
        });
        const valueCell = td({ children: [valueSpan, modifierSpan] });
        cells.push(valueCell);
    } else {
        cells.push(td({
            textContent: typeof currentValue === 'number' ? formatNumber(currentValue) : currentValue
        }));
    }

    return tr({ children: cells });
}

/**
 * Create a module card for colony view
 */
export function createModuleCard(
    iconName?: string,
    label?: string,
    filled: boolean = false
): HTMLDivElement {
    const classes = ['module-card'];
    if (filled) classes.push('filled');

    const children: HTMLElement[] = [];
    if (iconName) {
        children.push(
            span({
                classes: ['module-icon', 'material-symbols-rounded'],
                textContent: iconName
            })
        );
    }
    if (label) {
        children.push(span({ classes: ['module-label'], textContent: label }));
    }

    return div({ classes, children });
}

/**
 * Create a notification/toast message
 */
export function createNotification(
    message: string,
    duration: number = 3000
): HTMLDivElement {
    const notification = div({
        classes: ['notification'],
        textContent: message
    });

    // Auto-remove after duration
    setTimeout(() => {
        notification.remove();
    }, duration);

    return notification;
}

/**
 * Animate element using CSS classes
 */
export function animate(
    element: HTMLElement,
    animationClass: string,
    duration: number = 300
): Promise<void> {
    return new Promise(resolve => {
        addClass(element, animationClass);
        setTimeout(() => {
            removeClass(element, animationClass);
            resolve();
        }, duration);
    });
}

/**
 * Debounce function for event handlers
 */
export function debounce<T extends (...args: any[]) => void>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: number | undefined;
    return function executedFunction(...args: Parameters<T>) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = window.setTimeout(later, wait);
    };
}

/**
 * Throttle function for event handlers
 */
export function throttle<T extends (...args: any[]) => void>(
    func: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    return function executedFunction(...args: Parameters<T>) {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}

/**
 * Add event listener with automatic cleanup
 */
export function addListener<K extends keyof HTMLElementEventMap>(
    element: HTMLElement,
    event: K,
    handler: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions
): () => void {
    element.addEventListener(event, handler, options);
    return () => element.removeEventListener(event, handler, options);
}

/**
 * Create a view hotbar (modal header)
 */
export function createViewHotbar(
    title: string,
    onClose?: () => void
): HTMLDivElement {
    const closeButton = iconButton('close', onClose);

    return div({
        classes: ['view-hotbar'],
        children: [
            span({ classes: ['view-hotbar-title'], textContent: title }),
            closeButton
        ]
    });
}

/**
 * Create a view content container
 */
export function createViewContent(
    children?: HTMLElement[],
    columnLayout: boolean = false
): HTMLDivElement {
    const classes = ['view-content'];
    if (columnLayout) classes.push('column');

    return div({ classes, children });
}

/**
 * Batch update multiple elements
 */
export function batchUpdate(updates: Array<{ element: HTMLElement; update: () => void }>): void {
    // Use requestAnimationFrame for efficient batch updates
    requestAnimationFrame(() => {
        updates.forEach(({ element, update }) => {
            update();
        });
    });
}

/**
 * Create a row container
 */
export function row(children?: HTMLElement[], additionalClasses?: string[]): HTMLDivElement {
    return div({
        classes: ['row', ...(additionalClasses || [])],
        children
    });
}

/**
 * Create a column container
 */
export function column(children?: HTMLElement[], additionalClasses?: string[]): HTMLDivElement {
    return div({
        classes: ['column', ...(additionalClasses || [])],
        children
    });
}

/**
 * Safe element disposal with event listener cleanup
 */
export function dispose(element: HTMLElement): void {
    // Remove all event listeners by cloning
    const clone = element.cloneNode(true) as HTMLElement;
    element.parentNode?.replaceChild(clone, element);
    // Then remove from DOM
    clone.remove();
}
