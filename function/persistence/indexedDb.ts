const DB_NAME = "mars-inc";
const DB_VERSION = 1;
const STORE_NAME = "saves";

export type SaveRecord = {
    slot: string;
    payload: any;
    savedAt: number;
    version: number;
};

function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);

        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "slot" });
            }
        };

        request.onsuccess = () => resolve(request.result);
    });
}

export async function putSave(record: SaveRecord): Promise<void> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function getSave(slot: string): Promise<SaveRecord | null> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(slot);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error);
    });
}

export async function deleteSave(slot: string): Promise<void> {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.delete(slot);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}
