#!/usr/bin/env node
/**
 * Run this script once to apply migration 003:
 *   - Add LECTOR enum value
 *   - Update minister.roles data
 *   - Add GRANT and RLS UPDATE policy for minister table
 *
 * Usage:
 *   DB_PASSWORD=<your-db-password> node scripts/apply-migration-003.js
 *
 * Find your database password at:
 *   https://supabase.com/dashboard/project/yznxovrzaztqxdacqvop/settings/database
 *   → Section "Connection string" → copy the password shown there
 */

const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const DB_PASSWORD = process.env.DB_PASSWORD;
if (!DB_PASSWORD) {
  console.error("Error: DB_PASSWORD environment variable is required.");
  console.error("Usage: DB_PASSWORD=<password> node scripts/apply-migration-003.js");
  process.exit(1);
}

const SQL = fs.readFileSync(
  path.join(__dirname, "../supabase/migrations/003_lector_and_minister_rls.sql"),
  "utf8"
);

async function run() {
  // Try direct connection first, then pooler
  const configs = [
    {
      label: "direct",
      host: "db.yznxovrzaztqxdacqvop.supabase.co",
      port: 5432,
      user: "postgres",
      password: DB_PASSWORD,
    },
    {
      label: "pooler (session mode)",
      host: "aws-0-us-east-1.pooler.supabase.com",
      port: 5432,
      user: `postgres.yznxovrzaztqxdacqvop`,
      password: DB_PASSWORD,
    },
  ];

  let client = null;
  for (const cfg of configs) {
    const c = new Client({
      ...cfg,
      database: "postgres",
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
    });
    try {
      console.log(`Trying ${cfg.label} connection…`);
      await c.connect();
      client = c;
      console.log(`Connected via ${cfg.label}.`);
      break;
    } catch (e) {
      console.log(`  Failed: ${e.message}`);
      try { await c.end(); } catch {}
    }
  }

  if (!client) {
    console.error("\nCould not connect to the database.");
    console.error("Alternatively, paste the contents of");
    console.error("  supabase/migrations/003_lector_and_minister_rls.sql");
    console.error("into the Supabase SQL Editor at:");
    console.error("  https://supabase.com/dashboard/project/yznxovrzaztqxdacqvop/sql/new");
    process.exit(1);
  }

  // Split on the commit boundary between ALTER TYPE and UPDATE
  const [alterPart, restPart] = SQL.split(/^-- Commit so/m);

  try {
    console.log("\nStep 1: Adding LECTOR enum value…");
    await client.query(alterPart.trim());
    console.log("  Done.");

    console.log("Step 2: Updating minister.roles data…");
    const updateMatch = restPart.match(/UPDATE public\.minister[\s\S]+?;/);
    if (updateMatch) {
      const result = await client.query(updateMatch[0]);
      console.log(`  Updated ${result.rowCount} minister row(s).`);
    }

    console.log("Step 3: Adding GRANTs and RLS policy…");
    const grantSection = restPart.replace(/^[\s\S]*?GRANT/, "GRANT");
    await client.query(grantSection.trim());
    console.log("  Done.");

    console.log("\nMigration 003 applied successfully.");
  } catch (e) {
    console.error("\nMigration failed:", e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
