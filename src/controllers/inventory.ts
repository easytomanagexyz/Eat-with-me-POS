import { Request, Response } from 'express';
import type { PrismaClient, Prisma } from "@prisma/client";
import fs from "fs/promises";

export async function getAllInventoryItems(req: Request, res: Response) {
  const prisma = (req as any).prisma;
  try {
    const items = await prisma.inventoryItem.findMany({
      include: { supplier: true },
      orderBy: { name: 'asc' },
    });
    res.json(items);
  } catch (error) {
    console.error('Error fetching inventory items:', error);
    res.status(500).json({ error: 'Failed to fetch inventory items' });
  }
}

export async function getInventoryItemById(req: Request, res: Response) {
  const { id } = req.params;
  try {
    const prisma = (req as any).prisma as PrismaClient;
    const item = await prisma.inventoryItem.findUnique({ where: { id }, include: { supplier: true } });
    if (!item) {
      console.log(`GET /inventory/${id} - not found`);
      return res.status(404).json({ error: "Inventory item not found" });
    }
    console.log(`GET /inventory/${id} - fetched`);
    return res.json(item);
  } catch (err) {
    console.error(`GET /inventory/${req.params.id} error:`, (err as any).message || err);
    return res.status(500).json({ error: "Failed to fetch inventory item" });
  }
}

export async function createInventoryItem(req: Request, res: Response) {
  const prisma = (req as any).prisma;
  try {
    const { supplierId, ...data } = req.body;
    const newItem = await prisma.inventoryItem.create({
      data: { ...data, supplier: supplierId ? { connect: { id: supplierId } } : undefined },
    });
    res.status(201).json(newItem);
  } catch (error) {
    console.error('Error creating inventory item:', error);
    res.status(500).json({ error: 'Failed to create inventory item' });
  }
}

export async function updateInventoryItem(req: Request, res: Response) {
  const prisma = (req as any).prisma;
  const { id } = req.params;
  try {
    const { supplierId, ...data } = req.body;
    const updatedItem = await prisma.inventoryItem.update({
      where: { id },
      data: { ...data, supplier: supplierId ? { connect: { id: supplierId } } : undefined },
    });
    res.json(updatedItem);
  } catch (error) {
    console.error(`Error updating inventory item ${id}:`, error);
    res.status(500).json({ error: 'Failed to update item' });
  }
}

export async function deleteInventoryItem(req: Request, res: Response) {
  const prisma = (req as any).prisma;
  const { id } = req.params;
  try {
    await prisma.inventoryItem.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error(`Error deleting inventory item ${id}:`, error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
}

export async function getInventoryCategories(req: Request, res: Response) {
  try {
    const prisma = (req as any).prisma as PrismaClient;
    const categories = await prisma.inventoryItem.findMany({ distinct: ["category"], select: { category: true } });
    console.log(`GET /inventory/categories - fetched categories: count=${categories.length}`);
    return res.json(categories.map((c: { category: any; }) => c.category));
  } catch (err) {
    console.error("GET /inventory/categories error:", (err as any).message || err);
    return res.status(500).json({ error: "Failed to get categories" });
  }
}

export async function getInventoryStats(req: Request, res: Response) {
  try {
    const prisma = (req as any).prisma as PrismaClient;
    const items = await prisma.inventoryItem.findMany();
    const total = items.length;
    const lowStock = items.reduce((count: number, it: any) => {
      const current = Number((it as any).currentStock) || 0;
      const min = Number((it as any).minStock) || 0;
      return current <= min ? count + 1 : count;
    }, 0);
    const expiringSoon = items.reduce((count: number, it: any) => {
       const expiry = (it as any).expiryDate;
       if (!expiry) return count;
       const days = Math.ceil(((new Date(expiry)).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
       return days <= 7 && days >= 0 ? count + 1 : count;
     }, 0);
    const totalValue = items.reduce((sum: number, it: any) => {
      const cs = Number((it as any).currentStock) || 0;
      const cpu = Number((it as any).costPerUnit) || 0;
      return sum + cs * cpu;
    }, 0);
    console.log(`GET /inventory/stats - total=${total} lowStock=${lowStock} expiringSoon=${expiringSoon} totalValue=${totalValue}`);
    return res.json({ total, lowStock, expiringSoon, totalValue });
  } catch (err) {
    console.error("GET /inventory/stats error:", (err as any).message || err);
    return res.status(500).json({ error: "Failed to get inventory stats" });
  }
}

export async function createPurchaseEntry(req: Request, res: Response) {
  try {
    const prisma = (req as any).prisma as PrismaClient;
    const body: any = req.body;
    if (!Array.isArray(body.items) || body.items.length === 0) {
      console.log("POST /inventory/purchases - no items provided");
      return res.status(400).json({ error: "Purchase items required" });
    }
    console.log(`POST /inventory/purchases - creating purchase with items=${body.items.length}`);

    // Resolve supplier: allow null, accept an existing id, or accept a supplier name (find or create)
    let supplierId: any = null;
    const supplierInput = body.supplierId ?? body.supplier ?? null;
    if (supplierInput) {
      // try treat as id first
      try {
        const maybeById = await prisma.supplier.findUnique({ where: { id: supplierInput } as any });
        if (maybeById) {
          supplierId = maybeById.id;
        } else if (typeof supplierInput === "string") {
          // try find by name (case-insensitive)
          const maybeByName = await prisma.supplier.findFirst({ where: { name: { equals: supplierInput, mode: "insensitive" } } as any });
          if (maybeByName) {
            supplierId = maybeByName.id;
          } else {
            // create new supplier record with given name
            const createdSupplier = await prisma.supplier.create({ data: { name: supplierInput } as any });
            supplierId = createdSupplier.id;
            console.log(`Created supplier with id=${supplierId} name=${supplierInput}`);
          }
        }
      } catch (e) {
        // If lookup by id throws or input type mismatch, fallback to null
        console.warn("Supplier resolution warning:", (e as any).message || e);
        supplierId = null;
      }
    }

    const totalAmount = body.items.reduce((s: number, it: any) => {
      const q = Number(it.quantity) || 0;
      const up = Number(it.unitPrice) || 0;
      return s + q * up;
    }, 0);

    const purchase = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const p = await tx.purchase.create({
        data: {
          supplierId: supplierId ?? null,
          invoiceNumber: body.invoiceNumber || null,
          date: body.date ? new Date(body.date) : new Date(),
          totalAmount,
          notes: body.notes || null,
        },
      });

      for (const it of body.items) {
        const qty = Number(it.quantity) || 0;
        const unitPrice = Number(it.unitPrice) || 0;
        await tx.purchaseItem.create({
          data: {
            purchaseId: p.id,
            inventoryItemId: it.inventoryItemId,
            quantity: qty,
            unitPrice,
            totalPrice: qty * unitPrice,
          },
        });
        await tx.inventoryItem.update({
          where: { id: it.inventoryItemId },
          data: { currentStock: { increment: qty }, lastPurchase: new Date() } as any,
        });
        console.log(`POST /inventory/purchases - inventory updated id=${it.inventoryItemId} +${qty}`);
      }

      return p;
    });

    console.log(`POST /inventory/purchases - purchase created id=${(purchase as any)?.id}`);
    return res.status(201).json(purchase);
  } catch (err) {
    console.error("POST /inventory/purchases error - stack:", (err as any).stack || err);
    return res.status(500).json({ error: (err as any).message || "Failed to create purchase entry" });
  }
 }

export async function getPurchaseEntries(req: Request, res: Response) {
  try {
    const prisma = (req as any).prisma as PrismaClient;
    const purchases = await prisma.purchase.findMany({
      include: { supplier: true, items: { include: { inventoryItem: true } } },
      orderBy: { date: "desc" },
    });
    console.log(`GET /inventory/purchases - fetched purchases: count=${purchases.length}`);
    return res.json(purchases);
  } catch (err) {
    console.error("GET /inventory/purchases error:", (err as any).message || err);
    return res.status(500).json({ error: "Failed to get purchase entries" });
  }
}

export async function recordWastageEntry(req: Request, res: Response) {
  try {
    const prisma = (req as any).prisma as PrismaClient;
    const body: any = req.body;
    if (!Array.isArray(body.items) || body.items.length === 0) {
      console.log("POST /inventory/wastage - no items provided");
      return res.status(400).json({ error: "Wastage items required" });
    }

    const items = body.items
      .map((it: any) => ({
        inventoryItemId: it.inventoryItemId,
        quantity: Math.max(0, Number(it.quantity) || 0),
        reason: it.reason ? String(it.reason).trim() : null,
      }))
      .filter((it: any) => it.inventoryItemId && it.quantity > 0);

    if (items.length === 0) {
      return res.status(400).json({ error: "No valid wastage items" });
    }

    const timestamp = new Date().toISOString();
    const updates = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const out: any[] = [];
      for (const it of items) {
        // decrement stock (Prisma will throw if id invalid)
        const updated = await tx.inventoryItem.update({
          where: { id: it.inventoryItemId },
          data: { currentStock: { decrement: it.quantity }, lastPurchase: null } as any,
        });
        out.push({ inventoryItemId: it.inventoryItemId, quantity: it.quantity, afterStock: (updated as any).currentStock });
      }
      return out;
    });

    const logEntry = {
      id: `wst_${Date.now()}`,
      date: timestamp,
      items,
      notes: body.notes || null,
      updates,
    };
    await fs.appendFile("./wastage.log", JSON.stringify(logEntry) + "\n", "utf8");

    console.log(`POST /inventory/wastage - recorded wastage id=${logEntry.id} items=${items.length}`);
    return res.status(201).json(logEntry);
  } catch (err) {
    console.error("POST /inventory/wastage error - stack:", (err as any).stack || err);
    return res.status(500).json({ error: (err as any).message || "Failed to record wastage" });
  }
}

export async function getWastageEntries(req: Request, res: Response) {
  try {
    // read the simple newline-delimited JSON log created by recordWastageEntry
    const raw = await fs.readFile("./wastage.log", "utf8").catch(() => "");
    if (!raw || raw.trim() === "") {
      console.log("GET /inventory/wastage - no wastage records");
      return res.json([]);
    }
    const lines = raw.trim().split("\n").filter(Boolean);
    const entries = lines.map((ln) => {
      try {
        return JSON.parse(ln);
      } catch {
        return { raw: ln };
      }
    });
    // return newest first
    return res.json(entries.reverse());
  } catch (err) {
    console.error("GET /inventory/wastage error - stack:", (err as any).stack || err);
    return res.status(500).json({ error: (err as any).message || "Failed to read wastage entries" });
  }
}
