import { PrismaClient as MasterPrismaClient } from '../src/generated/master';

export const masterPrisma = new MasterPrismaClient();
