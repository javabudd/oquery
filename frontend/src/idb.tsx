import {openDB} from "idb";

const DB_NAME = "chat-history";
const STORE_NAME = "messages";

export type Message = {
	role: string,
	content: string,
	conversation_id: string
}

export async function getDB() {
	return openDB(DB_NAME, 1, {
		upgrade(db) {
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				const store = db.createObjectStore(STORE_NAME, {keyPath: "id", autoIncrement: true});
				store.createIndex("conversation_id", "conversation_id", {unique: false});
			}
		}
	});
}

export async function saveMessage(message: Message) {
	const db = await getDB();
	await db.put(STORE_NAME, message);
}

export async function getMessagesByConversation(conversation_id: string) {
	const db = await getDB();
	return await db.getAllFromIndex(STORE_NAME, "conversation_id", conversation_id);
}

export async function getAllMessages() {
	const db = await getDB();
	return await db.getAll(STORE_NAME);
}

export async function clearHistory() {
	const db = await getDB();
	await db.clear(STORE_NAME);
}
