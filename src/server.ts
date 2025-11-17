
import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app';
import { liveUpdates } from './utils/liveUpdates';
import { setMasterDbUrlFromSSM, setMasterDbUrlFromSecretsManager } from './utils/dbManager';

const PORT = process.env.PORT || 4000;


(async () => {
  // Option 1: If you stored the connection string directly in SSM Parameter Store
  // await setMasterDbUrlFromSSM('/prod/master-db-url'); // Use your actual SSM parameter name

  // Option 2: If you stored credentials in Secrets Manager (recommended for RDS)
  // await setMasterDbUrlFromSecretsManager('rds!db-a94ee905-92be-4173-86bf-b80b079be5da-YjfheA', 'master_db'); // Use your actual secret ID and DB name

  // For your current setup, if you stored the full connection string in SSM:
  await setMasterDbUrlFromSSM('/prod/master-db-url');

  if (process.env.REDIS_URL) {
    liveUpdates.configure(process.env.REDIS_URL);
  }

  const app = await createApp();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
})();
