#!/usr/bin/env node
/**
 * Interactive Setup Guide for kinetiCORE Cloud Asset Library
 * This script provides step-by-step instructions and opens necessary files
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

console.log('\n🚀 kinetiCORE Cloud Asset Library Setup Guide\n');
console.log('═'.repeat(70));
console.log('\nThis guide will help you set up your cloud database in 5 minutes.');
console.log('\n');

// Step 1: Open Supabase Dashboard
console.log('📋 STEP 1: Open Supabase SQL Editor');
console.log('─'.repeat(70));
console.log('\n1. Open this URL in your browser:');
console.log('   https://supabase.com/dashboard/project/nhkusjsounzwkmevjsgl/editor\n');
console.log('2. Click "SQL Editor" in the left sidebar');
console.log('3. Click "+ New Query" button (green, top-right)\n');

// Step 2: Migration SQL
console.log('\n📋 STEP 2: Run Migration SQL (Create Tables)');
console.log('─'.repeat(70));

const migrationPath = join(projectRoot, 'supabase', 'migrations', '20240101000000_create_asset_tables.sql');
const migrationSQL = readFileSync(migrationPath, 'utf8');

console.log('\n✅ Migration SQL is ready!');
console.log(`   File: ${migrationPath}`);
console.log(`   Size: ${migrationSQL.length} characters\n`);

console.log('📝 TO DO:');
console.log('   1. Open the file above in VS Code');
console.log('   2. Select ALL (Ctrl+A)');
console.log('   3. Copy (Ctrl+C)');
console.log('   4. Paste into Supabase SQL Editor (Ctrl+V)');
console.log('   5. Click "RUN" button (bottom-right)');
console.log('   6. Wait for: "Success. No rows returned"\n');

// Step 3: Seed SQL
console.log('\n📋 STEP 3: Run Seed SQL (Add Starter Assets)');
console.log('─'.repeat(70));

const seedPath = join(projectRoot, 'supabase', 'seed.sql');
const seedSQL = readFileSync(seedPath, 'utf8');

console.log('\n✅ Seed SQL is ready!');
console.log(`   File: ${seedPath}`);
console.log(`   Size: ${seedSQL.length} characters\n`);

console.log('📝 TO DO:');
console.log('   1. Click "+ New Query" again in Supabase SQL Editor');
console.log('   2. Open the file above in VS Code');
console.log('   3. Select ALL (Ctrl+A)');
console.log('   4. Copy (Ctrl+C)');
console.log('   5. Paste into Supabase SQL Editor (Ctrl+V)');
console.log('   6. Click "RUN" button');
console.log('   7. Wait for: "Success. No rows returned"\n');

console.log('   This will add 5 public starter assets:');
console.log('   • Fanuc LR Mate 200iD Robot');
console.log('   • KUKA KR 120 R2500 Pro');
console.log('   • ABB IRB 6700 Robot');
console.log('   • Conveyor Belt System');
console.log('   • Work Cell Layout\n');

// Step 4: Verify
console.log('\n📋 STEP 4: Verify Setup');
console.log('─'.repeat(70));
console.log('\nAfter running both SQL files, run this command:\n');
console.log('   node scripts/test-cloud-connection.js\n');
console.log('Expected output:');
console.log('   ✅ Database connected! Found 5 total assets');
console.log('   ✅ Found 5 public starter assets\n');

// Summary
console.log('\n' + '═'.repeat(70));
console.log('📊 SUMMARY');
console.log('═'.repeat(70));
console.log('\n✅ Files ready:');
console.log(`   • Migration: ${migrationPath}`);
console.log(`   • Seed:      ${seedPath}`);
console.log('\n⏱️  Time estimate: 5 minutes');
console.log('🔗 Dashboard: https://supabase.com/dashboard/project/nhkusjsounzwkmevjsgl/editor');
console.log('\n💡 TIP: Keep this terminal open while you complete the steps!\n');

// Try to open files in VS Code (Windows)
console.log('🔧 Opening files in VS Code...\n');

try {
  exec(`code "${migrationPath}"`, (error) => {
    if (error) {
      console.log(`⚠️  Could not auto-open migration file`);
    } else {
      console.log(`✅ Opened: 20240101000000_create_asset_tables.sql`);
    }
  });

  setTimeout(() => {
    exec(`code "${seedPath}"`, (error) => {
      if (error) {
        console.log(`⚠️  Could not auto-open seed file`);
      } else {
        console.log(`✅ Opened: seed.sql`);
      }
    });
  }, 1000);

} catch (error) {
  console.log('⚠️  Could not auto-open files in VS Code');
  console.log('   Please open them manually from the paths above.\n');
}

console.log('\n🎯 Ready to begin? Follow the steps above!\n');
