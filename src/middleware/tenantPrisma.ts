// import { Request, Response, NextFunction } from 'express';
// // --- FIX: Use a direct relative path to the generated master client ---
// import { PrismaClient as MasterPrismaClient } from '../generated/master';
// import { getTenantPrismaClient } from '../utils/dbManager';

// const masterPrisma = new MasterPrismaClient();

// export async function tenantPrisma(req: Request, res: Response, next: NextFunction) {
//   const headerRestaurantId = req.headers['x-restaurant-id'] as string | undefined;
//   const bodyRestaurantId = (req.body && typeof req.body === 'object') ? (req.body as Record<string, any>).restaurantId : undefined;
//   const restaurantId = headerRestaurantId || bodyRestaurantId || (req as any).restaurantId;

//   // Public routes like /signup don't need this middleware's logic.
//   // They will be handled before this middleware is even called.
//   // For /login, we need the restaurantId to connect to the right DB.
//   if (!restaurantId) {
//     // Allow login path to proceed to its controller, which will show a more specific error.
//     if (req.path === '/login') {
//         return next();
//     }
//     return res.status(400).json({ message: 'Restaurant ID is required in the X-Restaurant-Id header.' });
//   }

//   try {
//     const tenant = await masterPrisma.tenant.findUnique({
//       where: { restaurantId },
//     });

//     if (!tenant) {
//       return res.status(404).json({ message: 'Restaurant not found.' });
//     }

//     const tenantPrismaClient = getTenantPrismaClient(tenant.dbName);
//     (req as any).prisma = tenantPrismaClient;
//     (req as any).tenant = tenant; // Attach tenant info for use in controllers (e.g., login JWT)
//     (req as any).useRedis = Boolean(tenant.useRedis);
//     next();
//   } catch (error) {
//     console.error('Error connecting to tenant database:', error);
//     return res.status(500).json({ message: 'Internal server error during DB connection.' });
//   }
// }




import { Request, Response, NextFunction } from "express";
import { PrismaClient as MasterPrismaClient } from "../generated/master";
import { getTenantPrismaClientWithParams } from "../utils/dbManager";
import { preloadSecrets } from "../utils/awsSecrets";

const masterPrisma = new MasterPrismaClient();

export async function tenantPrisma(req: Request, res: Response, next: NextFunction) {
  const headerId = req.headers["x-restaurant-id"] as string;
  const bodyId = (req.body as any)?.restaurantId;
  const restaurantId = headerId || bodyId;

  if (!restaurantId) {
    if (req.path === "/login") return next();
    return res.status(400).json({ message: "Restaurant ID missing" });
  }

  try {
    const tenant = await masterPrisma.tenant.findUnique({
      where: { restaurantId }
    });

    if (!tenant) return res.status(404).json({ message: "Tenant not found" });

    const secrets = await preloadSecrets([
      "/eatwithme/db-user",
      "/eatwithme/db-password",
      "/eatwithme/db-host",
      "/eatwithme/db-port"
    ]);

    const prisma = getTenantPrismaClientWithParams(
      tenant.dbName,
      secrets["/eatwithme/db-user"],
      secrets["/eatwithme/db-password"],
      secrets["/eatwithme/db-host"],
      secrets["/eatwithme/db-port"]
    );

    (req as any).prisma = prisma;
    (req as any).tenant = tenant;

    next();
  } catch (err) {
    console.error("Tenant DB error:", err);
    return res.status(500).json({ message: "Tenant DB connection error" });
  }
}
