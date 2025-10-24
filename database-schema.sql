-- Neural AI Agent Portal Database Schema
-- Run this in your Supabase SQL Editor

-- Enable Row Level Security
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create neural_profiles table
CREATE TABLE IF NOT EXISTS neural_profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    neural_id TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    avatar_url TEXT,
    neural_capabilities JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create neural_activities table for tracking user activities
CREATE TABLE IF NOT EXISTS neural_activities (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES neural_profiles(id) ON DELETE CASCADE,
    activity TEXT NOT NULL,
    activity_type TEXT DEFAULT 'general' CHECK (activity_type IN ('login', 'logout', 'node_toggle', 'general', 'error')),
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create neural_nodes table for tracking AI agent capabilities
CREATE TABLE IF NOT EXISTS neural_nodes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES neural_profiles(id) ON DELETE CASCADE,
    node_name TEXT NOT NULL,
    node_type TEXT NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    configuration JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, node_name)
);

-- Create neural_sessions table for tracking active sessions
CREATE TABLE IF NOT EXISTS neural_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES neural_profiles(id) ON DELETE CASCADE,
    session_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    session_end TIMESTAMP WITH TIME ZONE,
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT TRUE
);

-- Insert default neural nodes for each user
CREATE OR REPLACE FUNCTION create_default_neural_nodes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO neural_nodes (user_id, node_name, node_type, is_active) VALUES
    (NEW.id, 'Language Processing', 'cognitive', true),
    (NEW.id, 'Vision System', 'perception', false),
    (NEW.id, 'Decision Engine', 'logic', true),
    (NEW.id, 'Memory Banks', 'storage', false),
    (NEW.id, 'Learning Core', 'adaptation', true),
    (NEW.id, 'Communication Hub', 'interface', false);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-create neural nodes for new users
CREATE TRIGGER create_neural_nodes_trigger
    AFTER INSERT ON neural_profiles
    FOR EACH ROW
    EXECUTE FUNCTION create_default_neural_nodes();

-- Enable Row Level Security (RLS)
ALTER TABLE neural_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE neural_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE neural_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE neural_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies

-- Neural Profiles: Users can only see and edit their own profile
CREATE POLICY "Users can view own profile" ON neural_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON neural_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON neural_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Neural Activities: Users can only see their own activities
CREATE POLICY "Users can view own activities" ON neural_activities
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own activities" ON neural_activities
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Neural Nodes: Users can only see and modify their own nodes
CREATE POLICY "Users can view own nodes" ON neural_nodes
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own nodes" ON neural_nodes
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own nodes" ON neural_nodes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Neural Sessions: Users can only see their own sessions
CREATE POLICY "Users can view own sessions" ON neural_sessions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions" ON neural_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_neural_profiles_updated_at
    BEFORE UPDATE ON neural_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_neural_nodes_updated_at
    BEFORE UPDATE ON neural_nodes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample data (optional)
-- This will be inserted automatically when users sign up

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_neural_activities_user_id ON neural_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_neural_activities_timestamp ON neural_activities(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_neural_nodes_user_id ON neural_nodes(user_id);
CREATE INDEX IF NOT EXISTS idx_neural_sessions_user_id ON neural_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_neural_sessions_active ON neural_sessions(is_active);

-- Create a view for user dashboard statistics
CREATE OR REPLACE VIEW neural_dashboard_stats AS
SELECT 
    np.id as user_id,
    np.name,
    np.email,
    COUNT(DISTINCT nn.id) as total_nodes,
    COUNT(DISTINCT CASE WHEN nn.is_active THEN nn.id END) as active_nodes,
    COUNT(DISTINCT na.id) as total_activities,
    MAX(na.timestamp) as last_activity,
    np.last_login
FROM neural_profiles np
LEFT JOIN neural_nodes nn ON np.id = nn.user_id
LEFT JOIN neural_activities na ON np.id = na.user_id
GROUP BY np.id, np.name, np.email, np.last_login;
