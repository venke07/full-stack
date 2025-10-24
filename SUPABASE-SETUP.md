# 🚀 SUPABASE DATABASE SETUP INSTRUCTIONS

## Step-by-Step Database Setup

### 1. Go to Supabase Dashboard
- Visit: https://czqywmnordnnnvopeszm.supabase.co
- Click **"SQL Editor"** in the left sidebar

### 2. Create New Query
- Click **"New Query"**
- Name it: "Neural AI Portal Schema"

### 3. Copy & Paste the Schema
Copy the entire content from `database-schema.sql` and paste it into the SQL Editor.

### 4. Run the Schema
- Click **"Run"** button
- Wait for all statements to execute
- You should see "Success" messages

### 5. Verify Tables Created
Go to **"Table Editor"** and check for these tables:
- ✅ `neural_profiles`
- ✅ `neural_activities` 
- ✅ `neural_nodes`
- ✅ `neural_sessions`

## What This Creates

### Tables:
1. **neural_profiles** - User profile data
2. **neural_activities** - Login/logout activities
3. **neural_nodes** - Each user's 6 AI nodes
4. **neural_sessions** - Active user sessions

### Security:
- Row Level Security (RLS) enabled
- Users can only see their own data
- Automatic triggers for timestamps

### Features:
- Auto-creates 6 neural nodes for new users
- Activity logging
- Session tracking
- Dashboard statistics view

## Test After Setup
1. Start server: `npm start`
2. Visit: http://localhost:3000/api/test/database
3. Should show all tables as "✅ EXISTS"

## Troubleshooting
- If error occurs, check Supabase logs
- Make sure you're using PostgreSQL syntax
- All tables should have RLS enabled

After running this, your email verification will work properly because the database will be ready to store user data!