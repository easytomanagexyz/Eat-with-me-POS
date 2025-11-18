import { PrismaClient as MasterPrismaClient } from '../generated/master';

export const masterPrisma = new MasterPrismaClient();
