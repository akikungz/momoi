/**
 * Queue job data types for all background tasks
 * Jobs only contain trigger data (IDs). Workers query the database for full details.
 */

export interface ProvisionInstanceJobData {
  instanceId: number;
  userId: number;
}

export interface DeprovisionInstanceJobData {
  instanceId: number;
  userId: number;
}

export interface ProvisionInstanceJobResult {
  instanceId: number;
  status: 'success' | 'failed';
  message: string;
}

export interface DeprovisionInstanceJobResult {
  instanceId: number;
  status: 'success' | 'failed';
  message: string;
}
