#!/usr/bin/env node
/**
 * Automated Database Migration Script
 * Runs the asset library migration SQL directly via Supabase API
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

console.log('\n🔧 kinetiCORE Database Migration Tool\n');
console.log('═'.repeat(60));

async function runMigration() {
  try {
    // Read migration SQL file
    const migrationPath = join(projectRoot, 'supabase', 'migrations', '20240101000000_create_asset_tables.sql');
    console.log(`📄 Reading migration: ${migrationPath}`);

    const migrationSQL = readFileSync(migrationPath, 'utf8');
    console.log(`✅ Loaded ${migrationSQL.length} characters of SQL\n`);

    // Execute migration
    console.log('🚀 Executing migration...');
    console.log('   This will create:');
    console.log('   • user_profiles table');
    console.log('   • teams table');
    console.log('   • assets table');
    console.log('   • asset_metadata table');
    console.log('   • asset_versions table');
    console.log('   • asset_collaborators table');
    console.log('   • asset_comments table');
    console.log('   • asset_share_requests table');
    console.log('   • asset_analytics table');
    console.log('   • Storage buckets');
    console.log('   • Row Level Security policies\n');

    // Note: Supabase JS client doesn't support raw SQL execution
    // This requires using the REST API directly
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({ query: migrationSQL })
    });

    if (!response.ok) {
      console.error('❌ Migration failed');
      console.error('   Status:', response.status);
      console.error('   Response:', await response.text());
      console.log('\n📋 Manual setup required:');
      console.log('   1. Go to: https://supabase.com/dashboard/project/nhkusjsounzwkmevjsgl/editor');
      console.log('   2. Click "SQL Editor" → "New Query"');
      console.log(`   3. Copy contents of: ${migrationPath}`);
      console.log('   4. Paste and click "RUN"');
      process.exit(1);
    }

    console.log('✅ Migration completed successfully!\n');

  } catch (error) {
    console.error('❌ Error running migration:', error.message);
    console.log('\n📋 Manual setup required:');
    console.log('   1. Go to: https://supabase.com/dashboard/project/nhkusjsounzwkmevjsgl/editor');
    console.log('   2. Click "SQL Editor" → "New Query"');
    console.log('   3. Copy contents of: supabase/migrations/20240101000000_create_asset_tables.sql');
    console.log('   4. Paste and click "RUN"');
    process.exit(1);
  }
}

async function runSeed() {
  try {
    // Read seed SQL file
    const seedPath = join(projectRoot, 'supabase', 'seed.sql');
    console.log(`📄 Reading seed data: ${seedPath}`);

    const seedSQL = readFileSync(seedPath, 'utf8');
    console.log(`✅ Loaded ${seedSQL.length} characters of SQL\n`);

    console.log('🌱 Seeding database with starter assets...');
    console.log('   • Fanuc LR Mate 200iD Robot');
    console.log('   • KUKA KR 120 R2500 Pro');
    console.log('   • ABB IRB 6700 Robot');
    console.log('   • Conveyor Belt System');
    console.log('   • Work Cell Layout\n');

    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`
      },
      body: JSON.stringify({ query: seedSQL })
    });

    if (!response.ok) {
      console.error('❌ Seeding failed');
      console.error('   Status:', response.status);
      console.error('   Response:', await response.text());
      console.log('\n📋 Manual seed required:');
      console.log('   1. Go to: https://supabase.com/dashboard/project/nhkusjsounzwkmevjsgl/editor');
      console.log('   2. Click "SQL Editor" → "New Query"');
      console.log(`   3. Copy contents of: ${seedPath}`);
      console.log('   4. Paste and click "RUN"');
      process.exit(1);
    }

    console.log('✅ Seed data added successfully!\n');

  } catch (error) {
    console.error('❌ Error running seed:', error.message);
    console.log('\n📋 Manual seed required:');
    console.log('   1. Go to: https://supabase.com/dashboard/project/nhkusjsounzwkmevjsgl/editor');
    console.log('   2. Click "SQL Editor" → "New Query"');
    console.log('   3. Copy contents of: supabase/seed.sql');
    console.log('   4. Paste and click "RUN"');
    process.exit(1);
  }
}

async function verifySetup() {
  console.log('🔍 Verifying setup...\n');

  // Test connection
  const { data, error, count } = await supabase
    .from('assets')
    .select('*', { count: 'exact', head: false })
    .limit(0);

  if (error) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  }

  console.log(`✅ Database connected! Found ${count} total assets`);

  // List public assets
  const { data: publicAssets, error: publicError } = await supabase
    .from('assets')
    .select('id, name, domain, asset_class, asset_type, visibility, tags')
    .eq('visibility', 'public')
    .limit(10);

  if (publicError) {
    console.error('❌ Failed to fetch public assets:', publicError.message);
  } else if (publicAssets && publicAssets.length > 0) {
    console.log(`\n✅ Found ${publicAssets.length} public starter assets:`);
    publicAssets.forEach((asset, i) => {
      console.log(`   ${i + 1}. ${asset.name} (${asset.asset_class} / ${asset.asset_type})`);
      console.log(`      Domain: ${asset.domain} | Tags: ${asset.tags?.join(', ') || 'none'}`);
    });
  } else {
    console.log('\n⚠️  No public assets found (seed data not loaded yet)');
  }

  console.log('\n' + '═'.repeat(60));
  console.log('🎉 Setup complete! Your cloud asset library is ready.\n');
}

// Main execution
(async () => {
  console.log('Starting automated database setup...\n');

  await runMigration();
  await runSeed();
  await verifySetup();

  console.log('✅ All done! Run your app with: npm run dev\n');
})();
