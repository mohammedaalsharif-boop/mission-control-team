/**
 * Run with: node scripts/wipe-data.mjs
 *
 * This script calls the wipe.wipeOrg mutation repeatedly until all
 * spaces, projects, tasks, subtasks, and related data are deleted.
 *
 * You must be logged in to Convex (npx convex login) and have
 * CONVEX_DEPLOYMENT set in .env.local.
 *
 * Usage:
 *   CONVEX_URL=https://your-deployment.convex.cloud node scripts/wipe-data.mjs <orgId>
 *
 * Or if NEXT_PUBLIC_CONVEX_URL is set in .env.local, just:
 *   node scripts/wipe-data.mjs <orgId>
 */
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import { readFileSync } from "fs";

// Read URL from env or .env.local
let url = process.env.CONVEX_URL;
if (!url) {
  try {
    const envLocal = readFileSync(".env.local", "utf-8");
    const match = envLocal.match(/NEXT_PUBLIC_CONVEX_URL=(.+)/);
    if (match) url = match[1].trim();
  } catch {}
}

if (!url) {
  console.error("Error: Set CONVEX_URL or have NEXT_PUBLIC_CONVEX_URL in .env.local");
  process.exit(1);
}

const orgId = process.argv[2];
if (!orgId) {
  console.error("Usage: node scripts/wipe-data.mjs <orgId>");
  console.error("  Find your orgId in the Convex dashboard under the organizations table.");
  process.exit(1);
}

const client = new ConvexHttpClient(url);

console.log(`\n🗑️  Wiping all data for org: ${orgId}`);
console.log(`   Convex URL: ${url}\n`);

let pass = 1;
while (true) {
  try {
    const result = await client.mutation(api.wipe.wipeOrg, { orgId });
    console.log(`   Pass ${pass}: deleted ${result.deleted} records`);
    if (result.done) {
      console.log("\n✅ Done! All spaces, projects, tasks, and related data have been deleted.\n");
      break;
    }
    pass++;
  } catch (err) {
    console.error(`\n❌ Error on pass ${pass}:`, err.message || err);
    console.error("   Make sure you are an admin for this organization.");
    process.exit(1);
  }
}
