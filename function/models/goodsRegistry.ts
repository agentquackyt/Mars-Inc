import { Category, Good, ProductionRequirement } from "./good";

// Define all goods with their complete data in one place
// This makes it easy to add, modify, or remove goods
const GOODS_DATA = [
    {
        id: 1,
        name: "Food",
        category: Category.Food,
        baseProductionPerSol: 1.5,
        marketBuyPrice: 50,
        marketSellPrice: 40
    },
    {
        id: 2,
        name: "Water",
        category: Category.Food,
        baseProductionPerSol: 1.2,
        marketBuyPrice: 40,
        marketSellPrice: 25
    },
    {
        id: 3,
        name: "Fuel",
        category: Category.Fuel,
        baseProductionPerSol: 1,
        marketBuyPrice: 100,
        marketSellPrice: 70
    },
    {
        id: 4,
        name: "Computer",
        category: Category.Electronics,
        baseProductionPerSol: 0.8,
        productionRequirement: ProductionRequirement.EARTH_ONLY,
        marketBuyPrice: 500,
        marketSellPrice: 350
    },
    {
        id: 5,
        name: "Circuit Board",
        category: Category.Electronics,
        baseProductionPerSol: 0.6,
        productionRequirement: ProductionRequirement.EARTH_ONLY,
        marketBuyPrice: 300,
        marketSellPrice: 200
    },
    {
        id: 6,
        name: "Solar Panel",
        category: Category.Electronics,
        baseProductionPerSol: 1,
        productionRequirement: ProductionRequirement.EARTH_ONLY,
        marketBuyPrice: 400,
        marketSellPrice: 280
    },
    {
        id: 7,
        name: "O2",
        category: Category.Fuel,
        baseProductionPerSol: 1.2,
        marketBuyPrice: 80,
        marketSellPrice: 50
    }
];

// Create the goods registry from the data
export const GoodsRegistry = new Map<number, Good>();

for (const data of GOODS_DATA) {
    const good = new Good(data.id, data.name, data.category, {
        baseProductionPerSol: data.baseProductionPerSol,
        productionRequirement: data.productionRequirement,
        marketBuyPrice: data.marketBuyPrice,
        marketSellPrice: data.marketSellPrice
    });
    GoodsRegistry.set(data.id, good);
}
