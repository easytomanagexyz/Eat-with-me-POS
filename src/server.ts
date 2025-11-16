
import dotenv from 'dotenv';
dotenv.config();

import app from './app';
import { liveUpdates } from './utils/liveUpdates';
import { setMasterDbUrlFromSSM } from './utils/dbManager';

const PORT = process.env.PORT ;

(async () => {
  // Fetch and set master DB URL from SSM before Prisma is used
  await setMasterDbUrlFromSSM('/prod/master-db-url'); // <-- Change to your actual SSM parameter name

  if (process.env.REDIS_URL) {
    liveUpdates.configure(process.env.REDIS_URL);
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
})();
