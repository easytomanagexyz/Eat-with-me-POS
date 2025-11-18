const { execSync } = require("child_process");

function runMigration() {
  const tenantDbUrl = process.env.DATABASE_URL_TENANT;
  if (!tenantDbUrl) {
    console.error("[Migration Script] Missing DATABASE_URL_TENANT.");
    process.exit(1);
  }

  console.log("[Migration Script] Running Prisma migration for tenant...");

  try {
    execSync(`npx prisma db push --schema=./prisma/tenant/schema.prisma`, {
      stdio: "inherit",
      env: {
        ...process.env,
        DATABASE_URL: tenantDbUrl,
        DATABASE_URL_TENANT: tenantDbUrl,
      },
    });

    console.log("[Migration Script] Tenant migration applied.");
  } catch (err) {
    console.error("[Migration Script] Failed:", err);
    process.exit(1);
  }
}

runMigration();
