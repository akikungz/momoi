import type { ObjectStorageProvider } from "@momoi/storage-provider";

import type { StorageProviderPort } from "../application/ports";

export class ObjectStoragePort implements StorageProviderPort {
	constructor(public readonly provider: ObjectStorageProvider) {}
}
