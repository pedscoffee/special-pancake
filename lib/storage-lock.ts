const LOCK = "kiddymeds-record-write";

/** The callback must be synchronous: read, transform, and write under one lock. */
export async function withStorageLock<T>(write: () => T): Promise<T> {
  // Every tab coordinates through an exclusive IndexedDB transaction.
  // Its async request also lets WebKit synchronize cross-process storage.
  // Care records remain in localStorage; this store only supplies the mutex.
  return new Promise<T>((resolve, reject) => {
    let cancelled = false;
    const request = indexedDB.open("kiddymeds-write-coordinator", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("lock");
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      cancelled = true;
      reject(new Error("Close older KiddyMeds tabs and try again."));
    };
    request.onsuccess = () => {
      const db = request.result;
      if (cancelled) {
        db.close();
        return;
      }
      const transaction = db.transaction("lock", "readwrite");
      const gate = transaction.objectStore("lock").get(LOCK);
      gate.onsuccess = () => {
        try {
          resolve(write());
        } catch (error) {
          reject(error);
        }
      };
      transaction.oncomplete = () => db.close();
      transaction.onabort = () => {
        db.close();
        reject(transaction.error);
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
    };
  });
}
