/** @format */

import express from 'express';
import { setMasterDbUrlFromSSM } from './utils/dbManager';
import cors from 'cors';
import { tenantPrisma } from './middleware/tenantPrisma';
import { authenticateToken } from './middleware/auth';

// --- FIX: Use the correct import style for each specific route ---
import { authRoutes } from './routes/auth';
import { staffRoutes } from './routes/staff';
import menuRoutes from './routes/menu'; // Corrected to default import
import { orderRoutes } from './routes/order';
import { tableRoutes } from './routes/table';
import { kitchenRoutes } from './routes/kitchen';
import categoryRoleRoutes from './routes/categoryRole'; // Corrected to default import
import settingsRoutes from './routes/settings'; // Corrected to default import
import inventoryRoutes from './routes/inventory'; // Corrected to default import
import { supplierRoutes } from './routes/supplier';
import { reportRoutes } from './routes/report';
import { customerRoutes } from './routes/customer';
import { reservationRoutes } from './routes/reservation';
import { expenseRoutes } from './routes/expense';
import { dashboardRoutes } from './routes/dashboard';
import { aiRoutes } from './routes/ai';
import { loyaltyRoutes } from './routes/loyalty';
import { marketingRoutes } from './routes/marketing';
import { shiftRoutes } from './routes/shifts';
import { recipeRoutes } from './routes/recipe';
import { budgetRoutes } from './routes/budget';


// Fetch DB URLs from AWS SSM (or use Secrets Manager helpers if preferred)
// These should be awaited before any Prisma client is initialized anywhere in your app


let app: express.Express;

(async () => {
	await setMasterDbUrlFromSSM('/prod/master-db-url'); // update with your actual SSM parameter name

	app = express();
	app.use(cors());
	app.use(express.json());

	// --- Public & Authentication Routes ---
	app.use('/api', authRoutes);

	// --- Protected Routes ---
	// All routes below this point require a tenant context and a valid authentication token.
	app.use('/api', authenticateToken);
	app.use('/api', tenantPrisma);

	// Wire up all your API routes to the /api base path
	app.use('/api/staff', staffRoutes);
	app.use('/api/menu', menuRoutes);
	app.use('/api/orders', orderRoutes);
	app.use('/api/tables', tableRoutes);
	app.use('/api/kitchen', kitchenRoutes);
	app.use('/api/category-role', categoryRoleRoutes);
	app.use('/api/settings', settingsRoutes);
	app.use('/api/inventory', inventoryRoutes);
	app.use('/api/suppliers', supplierRoutes);
	app.use('/api/reports', reportRoutes);
	app.use('/api/customers', customerRoutes);
	app.use('/api/reservations', reservationRoutes);
	app.use('/api/expenses', expenseRoutes);
	app.use('/api/recipes', recipeRoutes);
	app.use('/api/budgets', budgetRoutes);
	app.use('/api/dashboard', dashboardRoutes);
	app.use('/api/ai', aiRoutes);
	app.use('/api/loyalty', loyaltyRoutes);
	app.use('/api/marketing', marketingRoutes);
	app.use('/api/shifts', shiftRoutes);
})();

export default app;
