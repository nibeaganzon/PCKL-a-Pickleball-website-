export const LOCAL_INVENTORY_IMAGES_UPDATED_EVENT =
  "pckl-local-inventory-images-updated";

const DATABASE_NAME = "pckl-local-inventory-images";
const OBJECT_STORE_NAME = "images";
const objectUrls = new Map<string, { revision: string; url: string }>();

type StoredInventoryImage = {
  blob: Blob;
  revision: string;
};

function getImageKey(kind: "court" | "equipment", id: string) {
  return `${kind}:${id}`;
}

function openImageDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(OBJECT_STORE_NAME)) {
        request.result.createObjectStore(OBJECT_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Local image storage could not open."));
    request.onblocked = () =>
      reject(new Error("Local image storage is blocked by another tab."));
  });
}

export async function readLocalInventoryImages() {
  const database = await openImageDatabase();

  return new Promise<Record<string, string>>((resolve, reject) => {
    const transaction = database.transaction(OBJECT_STORE_NAME, "readonly");
    const store = transaction.objectStore(OBJECT_STORE_NAME);
    const keysRequest = store.getAllKeys();
    const imagesRequest = store.getAll();

    transaction.oncomplete = () => {
      const currentKeys = new Set<string>();
      const images: Record<string, string> = {};

      keysRequest.result.forEach((key, index) => {
        const stored = imagesRequest.result[index] as
          | StoredInventoryImage
          | undefined;
        if (
          typeof key !== "string" ||
          !stored ||
          !(stored.blob instanceof Blob) ||
          typeof stored.revision !== "string"
        ) {
          return;
        }

        currentKeys.add(key);
        const cached = objectUrls.get(key);
        if (cached?.revision === stored.revision) {
          images[key] = cached.url;
          return;
        }

        if (cached) URL.revokeObjectURL(cached.url);
        const url = URL.createObjectURL(stored.blob);
        objectUrls.set(key, { revision: stored.revision, url });
        images[key] = url;
      });

      for (const [key, cached] of objectUrls) {
        if (!currentKeys.has(key)) {
          URL.revokeObjectURL(cached.url);
          objectUrls.delete(key);
        }
      }

      resolve(images);
    };
    transaction.onerror = () =>
      reject(
        transaction.error ?? new Error("Local images could not be loaded.")
      );
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Local image loading was stopped."));
  });
}

export async function saveLocalInventoryImage(
  kind: "court" | "equipment",
  id: string,
  image: Blob
) {
  if (!image.type.startsWith("image/")) {
    throw new Error("Choose a valid image file.");
  }

  const database = await openImageDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(OBJECT_STORE_NAME, "readwrite");
    transaction.objectStore(OBJECT_STORE_NAME).put(
      { blob: image, revision: crypto.randomUUID() } satisfies StoredInventoryImage,
      getImageKey(kind, id)
    );
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("The image could not be saved."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Saving the image was stopped."));
  });

  const key = getImageKey(kind, id);
  const cached = objectUrls.get(key);
  if (cached) {
    URL.revokeObjectURL(cached.url);
    objectUrls.delete(key);
  }
  window.dispatchEvent(new Event(LOCAL_INVENTORY_IMAGES_UPDATED_EVENT));
}

export async function removeLocalInventoryImage(
  kind: "court" | "equipment",
  id: string
) {
  const key = getImageKey(kind, id);
  const database = await openImageDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(OBJECT_STORE_NAME, "readwrite");
    transaction.objectStore(OBJECT_STORE_NAME).delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("The image could not be removed."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("Removing the image was stopped."));
  });

  const cached = objectUrls.get(key);
  if (cached) {
    URL.revokeObjectURL(cached.url);
    objectUrls.delete(key);
  }
  window.dispatchEvent(new Event(LOCAL_INVENTORY_IMAGES_UPDATED_EVENT));
}

export function getLocalInventoryImage(
  images: Record<string, string>,
  kind: "court" | "equipment",
  id: string
) {
  return images[getImageKey(kind, id)];
}
