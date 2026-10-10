// IndexedDB "blackout-box" v1 (blackout-box brief, cache model): stores kv, items, chat.
import { openDB, type IDBPDatabase } from 'idb'

export type KvRecord<T = unknown> = { key: string; value: T; fetchedAt: string; source?: string }
export type ChatRecord = { id?: number; ts: string; lang: string; q: string; a: string; model?: string; offline?: boolean; filtered?: boolean; call911?: boolean }

let dbp: Promise<IDBPDatabase> | null = null

function db(): Promise<IDBPDatabase> {
  if (!dbp) {
    dbp = openDB('blackout-box', 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv', { keyPath: 'key' })
        if (!d.objectStoreNames.contains('items')) d.createObjectStore('items', { keyPath: 'id' })
        if (!d.objectStoreNames.contains('chat')) d.createObjectStore('chat', { keyPath: 'id', autoIncrement: true })
      },
    })
  }
  return dbp
}

// Every call is wrapped: storage can be blocked (private mode); the UI must still render.
export async function kvGet<T>(key: string): Promise<KvRecord<T> | undefined> {
  try { return (await (await db()).get('kv', key)) as KvRecord<T> | undefined } catch { return undefined }
}

export async function kvSet<T>(key: string, value: T, source?: string): Promise<void> {
  try { await (await db()).put('kv', { key, value, fetchedAt: new Date().toISOString(), source }) } catch { /* ignore */ }
}

export async function itemsAll<T>(): Promise<T[]> {
  try { return (await (await db()).getAll('items')) as T[] } catch { return [] }
}

export async function itemsReplace<T extends { id: string }>(items: T[]): Promise<void> {
  try {
    const tx = (await db()).transaction('items', 'readwrite')
    await tx.store.clear()
    for (const it of items) await tx.store.put(it)
    await tx.done
  } catch { /* ignore */ }
}

export async function chatAdd(r: ChatRecord): Promise<void> {
  try { await (await db()).add('chat', r) } catch { /* ignore */ }
}

export async function chatAll(): Promise<ChatRecord[]> {
  try { return (await (await db()).getAll('chat')) as ChatRecord[] } catch { return [] }
}
