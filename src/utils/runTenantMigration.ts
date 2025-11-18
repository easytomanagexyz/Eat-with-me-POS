const { execSync } = require("child_process");

function runMigration() {
  const url = process.env.DATABASE_URL_TENANT;

  if (!url) {
    console.error("[runTenantMigration] Missing DATABASE_URL_TENANT");
    process.exit(1);
  }

  console.log("[runTenantMigration] Running migration:", url);

  execSync(
    `npx prisma migrate deploy --schema=/home/ubuntu/Eat-with-me-POS/prisma/tenant/schema.prisma`,
    {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: url, DATABASE_URL_TENANT: url }
    }
  );

  console.log("[runTenantMigration] Migration completed");
}

runMigration();
