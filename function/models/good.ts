enum Category {
    Food = "Food",
    Electronics = "Electronics",
    Clothing = "Clothing",
    Furniture = "Furniture",
    Fuel = "Fuel",
    Science = "Science",
    ISRU = "ISRU"
}

class Good {
    private id: number;
    name: string;
    category: Category;

    constructor(id: number, name: string, category: Category) {
        this.id = id;
        this.name = name;
        this.category = category;
    }

    static fromData(data: any): Good {
        return new Good(data.id, data.name, data.category as Category);
    }

    toData(): any {
        return {
            id: this.id,
            name: this.name,
            category: this.category
        };
    }

    getId(): number {
        return this.id;
    }
}

class ItemPosition {
    good: Good;
    quantity: number;

    constructor(good: Good, quantity: number) {
        this.good = good;
        this.quantity = quantity;
    }

    toData(): any {
        return {
            good: this.good.getId(),
            quantity: this.quantity
        };
    }

    static fromData(data: any, goodsRegistry: Map<number, Good>): ItemPosition {
        const good = goodsRegistry.get(data.good);
        if (!good) {
            throw new Error(`Unknown good id: ${data.good}`);
        }
        return new ItemPosition(good, data.quantity);
    }

}

export { Good, Category, ItemPosition };