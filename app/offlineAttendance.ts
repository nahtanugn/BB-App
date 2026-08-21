"use client";

export type OfflineAttendanceChange = {
  sessionId: number;
  memberId: number;
  status: "present" | "absent" | "excused" | "unmarked";
  updatedAt: string;
};

const databaseName = "11kchbb-offline";
const storeName = "attendance";

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName, { keyPath: "key" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open offline queue"));
  });
}

export async function queueOfflineAttendance(change: OfflineAttendanceChange) {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const request = database.transaction(storeName, "readwrite").objectStore(storeName).put({ ...change, key: `${change.sessionId}:${change.memberId}` });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error("Unable to queue attendance"));
  });
  database.close();
}

export async function flushOfflineAttendance() {
  if (!navigator.onLine) return { applied: 0, conflicts: 0 };
  const database = await openDatabase();
  const changes = await new Promise<OfflineAttendanceChange[]>((resolve, reject) => {
    const request = database.transaction(storeName, "readonly").objectStore(storeName).getAll();
    request.onsuccess = () => resolve((request.result as Array<OfflineAttendanceChange & { key: string }>).map((item) => ({ sessionId: item.sessionId, memberId: item.memberId, status: item.status, updatedAt: item.updatedAt })));
    request.onerror = () => reject(request.error ?? new Error("Unable to read offline queue"));
  });
  database.close();
  if (!changes.length) return { applied: 0, conflicts: 0 };
  const response = await fetch("/api/feature-expansion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sync_attendance", changes }) });
  if (!response.ok) throw new Error("Unable to sync offline attendance");
  const result = await response.json() as { applied?: number; conflicts?: number };
  const cleared = await openDatabase();
  await new Promise<void>((resolve, reject) => { const request = cleared.transaction(storeName, "readwrite").objectStore(storeName).clear(); request.onsuccess = () => resolve(); request.onerror = () => reject(request.error); });
  cleared.close();
  return { applied: result.applied ?? 0, conflicts: result.conflicts ?? 0 };
}
