import {openDB} from "idb";

const DB_NAME = "chat-history";
const STORE_NAME = "messages";

export type Message = {
	role: string,
	content: string,
}

export async function getDB() {
	return openDB(DB_NAME, 1, {
		upgrade(db) {
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				db.createObjectStore(STORE_NAME, {keyPath: "id", autoIncrement: true});
			}
		}
	});
}

export async function saveMessage(message: Message) {
	const db = await getDB();
	await db.put(STORE_NAME, message);
}

export async function getAllMessages() {
	const db = await getDB();
	return await db.getAll(STORE_NAME);
}

export async function clearHistory() {
	const db = await getDB();
	await db.clear(STORE_NAME);
}
