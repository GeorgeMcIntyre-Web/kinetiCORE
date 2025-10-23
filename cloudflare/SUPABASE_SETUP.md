# Quick Supabase Project Setup Guide
# File: cloudflare/SUPABASE_SETUP.md
# Owner: George

# 🚀 Quick Supabase Project Setup

## Step 1: Create Supabase Project

1. **Go to:** https://supabase.com/dashboard
2. **Click:** "New Project"
3. **Fill in:**
   - **Organization:** Select your organization
   - **Project Name:** `kineticore-asset-library`
   - **Database Password:** Generate a strong password (save it!)
   - **Region:** Choose closest to your users
4. **Click:** "Create new project"

## Step 2: Get Your Credentials

1. **Wait for project to be ready** (2-3 minutes)
2. **Go to:** Settings → API
3. **Copy these values:**
   - **Project URL:** `https://your-project-id.supabase.co`
   - **Anon Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (public key)
   - **Service Role Key:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (secret key)

## Step 3: Update Cloudflare Worker

Once you have the credentials, I'll update the worker configuration:

```bash
# Update wrangler.jsonc with your actual values
SUPABASE_URL = "https://your-actual-project-id.supabase.co"
SUPABASE_ANON_KEY = "your-actual-anon-key"

# Set the service role secret
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# Enter your service role key when prompted
```

## Step 4: Deploy Database Schema

I'll run the migration to set up your asset library tables:

```bash
# Using Supabase CLI (if you have it)
supabase db push

# Or manually via Supabase Dashboard SQL Editor
# (I'll provide the SQL)
```

## Step 5: Test the Integration

Once deployed, we'll test:
- Authentication flow
- Asset upload/download
- Database operations
- Real-time features

## Current Status

✅ **Cloudflare Worker:** Ready and configured  
✅ **Worker Code:** Complete Supabase proxy  
⏳ **Supabase Project:** Need you to create  
⏳ **Credentials:** Need you to provide  
⏳ **Deployment:** Ready to deploy once we have credentials  

## Next Steps

1. **Create Supabase project** (5 minutes)
2. **Provide credentials** to me
3. **I'll deploy everything** (2 minutes)
4. **Test integration** (5 minutes)

**Total time:** ~12 minutes to have everything working!

---

**Meanwhile, Agent 1 is working on the MJCF kinematics pipeline** 🎯
