# Mars Inc.

## Overview

Mars Inc. is a single-player strategy game centered on managing a company that aims to colonize Mars and establish interplanetary commerce. The game combines resource management, infrastructure development, and strategic planning as the player expands their operations across multiple locations in the solar system. The project is built using TypeScript and runs in the browser, utilizing IndexedDB for persistent game state storage.

## Game Concept

The player assumes the role of a CEO managing a space colonization enterprise. Starting with limited resources and a headquarters on Earth, the objective is to expand operations to other celestial bodies including the Moon, Mars, and orbital space stations.

The core gameplay revolves around establishing colonies, upgrading productions, operating rocket fleets for transportation, and investing in upgrades that unlock new capabilities. Each decision affects the company's trajectory, from which goods to produce to where to establish the next outpost.

## Game Mechanics

### Company and Money Management

The player's company serves as the central entity through which all operations are managed. The company maintains a treasury that fluctuates based on production sales, upgrade purchases, and operational costs. Money is earned primarily through selling goods that colonies produce. The financial state is tracked in real-time and displayed in the heads-up display.

### Colonies and Production

Colonies are established at various locations throughout the solar system. Each colony can host multiple production modules that manufacture specific goods. Production modules are level-based systems that can be upgraded to increase output. The quantity of goods produced per sol (Martian day) scales with the module level, and each module requires a certain number of workers to operate.

Different locations offer varying production modifiers. Mars provides a five-times production multiplier, the Moon offers a four-times multiplier, and space stations operate at half efficiency. Earth operates at standard efficiency. These modifiers encourage strategic placement of production facilities based on economic goals.

Goods belong to categories including Food, Electronics, Clothing, Furniture, Fuel, Science, and ISRU (In-Situ Resource Utilization). Certain goods can only be produced in specific locations due to production requirements. For example, some items may require Earth's atmosphere, while others need low-gravity environments.

### Infrastructure Development

In addition to production modules, colonies can construct infrastructure modules that provide passive benefits. The Rocket Lab infrastructure increases the number of rockets the company can operate simultaneously, with the allowed count increasing as the structure levels up. The Storeroom infrastructure expands storage capacity, allowing colonies to accumulate larger stockpiles of goods before requiring shipment.

Infrastructure modules, like production modules, consume workers and can be upgraded through the same leveling system. Strategic infrastructure investment is necessary to support expanded operations.

### Rocket Fleet and Transportation

Rockets serve as the transportation backbone of the operation. Each rocket has a cargo capacity, travel speed, and level that can be upgraded.

The game tracks estimated travel time in minutes, which decrements as real time passes. Rockets can be configured to run automated sell routes, where they repeatedly travel between two locations, transporting goods for sale.

Exploration missions use rockets to establish colonies on new worlds. Once a rocket arrives at an unexplored location, a colony is automatically founded, opening that location for future operations.

### Leveling and Upgrades

Nearly every entity in the game uses a level system. Colonies, rockets, production modules, and infrastructure modules all have levels that can be increased by spending money. Each level increase requires progressively more resources, calculated using an exponential formula. Upgrading entities improves their capabilities, whether that means increased production output, faster travel times, or expanded capacity.

The properties of each entity change with levels, and the interface displays both current values and the increase that would result from the next upgrade. This allows players to make informed decisions about where to invest resources.

### Time Progression and Sols

The game operates on a Martian sol cycle, which is slightly longer than an Earth day. Time progresses continuously, with one sol taking a configurable number of real-time minutes to complete. Production accumulates throughout the sol, and certain events trigger at the end of each sol cycle. The current sol number and progress percentage are tracked and displayed.

### Tutorial System

New players are guided through the initial stages of the game by a tutorial system. The tutorial highlights specific interface elements, explains core concepts, and walks through essential actions like upgrading modules and managing rockets. Tutorial progress is saved, so players can resume or skip it based on their experience level.

## Playing the Game

### Starting a New Game

Upon launching the game, if no saved data exists, a new session is created automatically. The player begins with a company headquarters on Earth, a small amount of starting capital, and a basic production module that generates food. The tutorial launches automatically for first-time players, providing guidance through the initial actions.

### Managing Production

The main interface displays the list of colonies under the company's control. Each colony shows its current production modules and their status. Selecting a colony opens a detailed view where individual production modules can be managed. Clicking on a module opens a modal that displays current statistics, including production rate, workers needed, and upgrade cost.

To upgrade a production module, select it and choose the upgrade option if sufficient funds are available. The module level increases, resulting in higher production output. Monitor worker allocation to ensure modules can operate at full capacity.

### Building Infrastructure

Infrastructure modules are constructed through the colony interface. Access the build menu within a colony view and select the desired infrastructure type. Rocket Labs enable more rockets to be deployed, while Storerooms increase storage limits. Infrastructure upgrades follow the same pattern as production upgrades, with costs scaling by level.

### Operating Rockets

The rocket management interface lists all rockets in the fleet and their current status. Rockets can be idle at a location, traveling to a destination, or executing automated routes. To send a rocket on a journey, select it and choose a destination from the available connections. The interface calculates travel time based on current rocket speed.

Rockets can carry cargo, enabling goods to be transported between colonies. Loading and unloading cargo is managed through the rocket detail interface. For repetitive transportation needs, configure a sell route that automates the process of moving goods from one location to another and selling them at the destination.

### Exploration and Expansion

To establish a new colony, launch an exploration mission to an uncolonized location. Select a rocket and choose an exploration target from the available destinations. The rocket travels to the location, and upon arrival, a new colony is founded. The new colony starts with minimal infrastructure but can be built up over time.

Expansion to the Moon, Mars, and space stations unlocks access to location-specific production bonuses and goods that can only be manufactured in those environments.

### Economic Strategy

Success requires balancing production, transportation, and upgrades. Identify which goods have favorable sell prices and establish production chains to maximize profit. Use rockets efficiently to transport goods to markets where they command higher prices. Invest upgrade funds strategically, prioritizing improvements that offer the best return on investment.

Monitor the financial dashboard to track income and expenses. Plan major expenditures around production cycles to ensure sufficient working capital. As the company grows, reinvest profits into expanded production capacity and additional rockets to accelerate growth.

## Building and Development

### Prerequisites

The project requires Bun, a modern JavaScript runtime and toolkit. Bun handles both the development server and build processes. TypeScript is used throughout the codebase, providing static type checking and improved tooling support.

### Installation

Clone the repository to the local development environment. Navigate to the project directory and install dependencies using Bun. The package.json file specifies the necessary development dependencies, including TypeScript type definitions. No additional packages are installed next to the Bun runtime.

```
bun install
```

### Development Server

The development server serves the application locally and provides hot reloading during development. Start the server with the following command:

```
bun run dev
```

This launches the application and opens it in the default web browser. The server monitors source files for changes and automatically reloads the page when modifications are detected.

### Game Configuration

Game parameters such as production rates, upgrade costs, and time scaling are defined in config.ts. Adjust these values to modify game balance or testing parameters. The configuration uses a nested object structure organized by game system, making it straightforward to locate and modify specific parameters.

### Adding New Goods

Goods are registered in the GoodsRegistry module. To add a new good, instantiate a Good object with a unique identifier, name, category, and optional parameters for production requirements and market prices.

Example structure for adding a good:

```typescript
    {
        id: 7,
        name: "O2",
        category: Category.Fuel,
        baseProductionPerSol: 1.2,
        marketBuyPrice: 80,
        marketSellPrice: 50
    }
```

### Save System

Game state is persisted automatically at regular intervals using IndexedDB. The save system serializes the entire game session, including company state, colonies, rockets, and inventory. Loading occurs automatically on game startup, restoring the most recent save if available. Manual save and load operations can be triggered through the save system interface if needed for debugging or backup purposes.

## License

This project is published under MIT licence.