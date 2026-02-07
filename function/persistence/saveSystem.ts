import type { GameSession } from "../models/sessionModel";
import { GameSession as GameSessionClass } from "../models/sessionModel";
import { getSave, putSave, deleteSave, SaveRecord } from "./indexedDb";

const SAVE_VERSION = 1;
const DEFAULT_SLOT = "default";

export class SaveSystem {
    async save(session: GameSession, slot: string = DEFAULT_SLOT): Promise<void> {
        const payload = session.toData();
        const record: SaveRecord = {
            slot,
            payload,
            savedAt: Date.now(),
            version: SAVE_VERSION
        };
        await putSave(record);
    }

    async load(slot: string = DEFAULT_SLOT): Promise<GameSession | null> {
        const record = await getSave(slot);
        if (!record) return null;
        const payload = this.migrate(record);
        return GameSessionClass.fromData(payload);
    }

    async clear(slot: string = DEFAULT_SLOT): Promise<void> {
        await deleteSave(slot);
    }

    private migrate(record: SaveRecord): any {
        if (record.version === SAVE_VERSION) {
            return record.payload;
        }
        // Placeholder for future migrations
        return record.payload;
    }
}
