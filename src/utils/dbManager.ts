import { exec } from "child_process";
import util from "util";
import { PrismaClient as TenantPrismaClient } from "@prisma/client";
import { getParameter } from "./awsSecrets";
import { getSecret } from "./awsSecretsManager";

const execPromise = util.promisify(exec);

// Cache for Prisma Clients
const prismaClients: Record<string, TenantPrismaClient> = {};

function encode(val: string) {
  return encodeURIComponent(val);
}

//
// Build a valid psql connection
//
function buildPsql(user: string, pass: string, host: string, port: string, db: string) {
  const encodedPass = encode(pass);
  return `psql "postgresql://${user}:${encodedPass}@${host}:${port}/${db}"`;
}

//
// Tenant Prisma Client
//
export function getTenantPrismaClientWithParams(
  dbName: string,
  dbUser: string,
  dbPass: string,
  dbHost: string,
  dbPort: string
): TenantPrismaClient {
  if (prismaClients[dbName]) return prismaClients[dbName];

  const safePass = encode(dbPass);
  const url = `postgresql://${dbUser}:${safePass}@${dbHost}:${dbPort}/${dbName}?schema=public`;

  process.env.DATABASE_URL = url;
  process.env.DATABASE_URL_TENANT = url;

  const client = new TenantPrismaClient({
    datasources: { db: { url } }
  });

  prismaClients[dbName] = client;
  return client;
}

//
// Create Tenant DB + User
//
export async function createTenantDatabaseAndUser(
  dbName: string,
  tenantUser: string,
  tenantPass: string,
  rootUser: string,
  rootPass: string,
  host: string,
  port: string
) {
  const psql = buildPsql(rootUser, rootPass, host, port, "postgres");

  await execPromise(`${psql} -c "CREATE USER ${tenantUser} WITH PASSWORD '${tenantPass}';"`);
  await execPromise(`${psql} -c "CREATE DATABASE ${dbName};"`);
  await execPromise(`${psql} -c "GRANT ALL PRIVILEGES ON DATABASE ${dbName} TO ${tenantUser};"`);
}

//
// Run Prisma migrations for tenant
//
export async function runMigrationsForTenant(
  dbName: string,
  rootUser: string,
  rootPass: string,
  host: string,
  port: string
) {
  const safePass = encode(rootPass);

  const url = `postgresql://${rootUser}:${safePass}@${host}:${port}/${dbName}?schema=public`;

  console.log("⚠️ MIGRATION URL:", url);

  process.env.DATABASE_URL = url;
  process.env.DATABASE_URL_TENANT = url;

  const command = `npx prisma migrate deploy --schema=/home/ubuntu/Eat-with-me-POS/prisma/tenant/schema.prisma`;

  await execPromise(command, {
    env: {
      ...process.env,
      DATABASE_URL: url,
      DATABASE_URL_TENANT: url
    }
  });
}

//
// Drop Tenant DB
//
export async function dropTenantDatabaseAndUser(
  dbName: string,
  tenantUser: string,
  rootUser: string,
  rootPass: string,
  host: string,
  port: string
) {
  const psql = buildPsql(rootUser, rootPass, host, port, "postgres");

  await execPromise(
    `${psql} -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${dbName}' AND pid <> pg_backend_pid();"`
  );

  await execPromise(`${psql} -c "DROP DATABASE IF EXISTS ${dbName};"`);
  await execPromise(`${psql} -c "DROP USER IF EXISTS ${tenantUser};"`);
}
