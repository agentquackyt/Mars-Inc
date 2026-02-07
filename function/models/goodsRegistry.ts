import { Category, Good } from "./good";

export const GoodsRegistry = new Map<number, Good>();
GoodsRegistry.set(1, new Good(1, "Food", Category.Food));
GoodsRegistry.set(2, new Good(2, "Water", Category.Food)); 
GoodsRegistry.set(3, new Good(3, "Fuel", Category.Fuel));

GoodsRegistry.set(4, new Good(4, "Computer", Category.Electronics));
GoodsRegistry.set(5, new Good(5, "Circuit Board", Category.Electronics));
GoodsRegistry.set(7, new Good(7, "O2", Category.Fuel));
