-- Prompt Versioning & A/B Testing Tables
-- Migration for agent prompt versions and A/B test results

-- Table: agent_prompt_versions
-- Stores different prompt versions for each agent
CREATE TABLE IF NOT EXISTS agent_prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agent_personas(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  version_name TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  system_prompt TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID,
  
  -- Unique constraint: only one active version per agent
  CONSTRAINT unique_active_per_agent UNIQUE (agent_id, is_active) WHERE is_active = TRUE,
  CONSTRAINT unique_version_number_per_agent UNIQUE (agent_id, version_number)
);

-- Table: a_b_test_sessions
-- Stores A/B test configuration and results
CREATE TABLE IF NOT EXISTS a_b_test_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agent_personas(id) ON DELETE CASCADE,
  version_a_id UUID NOT NULL REFERENCES agent_prompt_versions(id) ON DELETE CASCADE,
  version_b_id UUID NOT NULL REFERENCES agent_prompt_versions(id) ON DELETE CASCADE,
  test_name TEXT NOT NULL,
  status TEXT DEFAULT 'active', -- active, completed, paused
  sample_size INT DEFAULT 0,
  completed_tests INT DEFAULT 0,
  winner_id UUID, -- ID of winning version
  confidence_score FLOAT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  
  CONSTRAINT different_versions CHECK (version_a_id != version_b_id)
);

-- Table: a_b_test_results
-- Individual test result for each conversation
CREATE TABLE IF NOT EXISTS a_b_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_session_id UUID NOT NULL REFERENCES a_b_test_sessions(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agent_personas(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES agent_prompt_versions(id) ON DELETE CASCADE,
  conversation_id TEXT,
  user_prompt TEXT NOT NULL,
  agent_response TEXT NOT NULL,
  response_time_ms INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: response_ratings
-- User feedback on agent responses
CREATE TABLE IF NOT EXISTS response_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agent_personas(id) ON DELETE CASCADE,
  conversation_id TEXT,
  test_result_id UUID REFERENCES a_b_test_results(id) ON DELETE SET NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5), -- 1-5 star rating
  quality_score FLOAT, -- 0-1 score for response quality
  relevance_score FLOAT, -- 0-1 score for relevance
  helpfulness_score FLOAT, -- 0-1 score for helpfulness
  feedback_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: prompt_improvement_suggestions
-- AI-generated suggestions for prompt improvements
CREATE TABLE IF NOT EXISTS prompt_improvement_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agent_personas(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES agent_prompt_versions(id) ON DELETE CASCADE,
  suggestion_type TEXT NOT NULL, -- clarity, specificity, tone, structure
  suggestion_text TEXT NOT NULL,
  reasoning TEXT,
  potential_impact TEXT,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_applied BOOLEAN DEFAULT FALSE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_prompt_versions_agent_id ON agent_prompt_versions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_prompt_versions_is_active ON agent_prompt_versions(agent_id, is_active);
CREATE INDEX IF NOT EXISTS idx_a_b_test_sessions_agent_id ON a_b_test_sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_a_b_test_results_test_session_id ON a_b_test_results(test_session_id);
CREATE INDEX IF NOT EXISTS idx_a_b_test_results_version_id ON a_b_test_results(version_id);
CREATE INDEX IF NOT EXISTS idx_response_ratings_agent_id ON response_ratings(agent_id);
CREATE INDEX IF NOT EXISTS idx_response_ratings_test_result_id ON response_ratings(test_result_id);
CREATE INDEX IF NOT EXISTS idx_prompt_suggestions_agent_id ON prompt_improvement_suggestions(agent_id);

-- Enable Row Level Security (RLS)
ALTER TABLE agent_prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE a_b_test_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE a_b_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_improvement_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow authenticated users to see their own data
CREATE POLICY "Users can view their agent versions" 
  ON agent_prompt_versions FOR SELECT 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage their agent versions" 
  ON agent_prompt_versions FOR ALL 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view test sessions" 
  ON a_b_test_sessions FOR SELECT 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage test sessions" 
  ON a_b_test_sessions FOR ALL 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view test results" 
  ON a_b_test_results FOR SELECT 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view ratings" 
  ON response_ratings FOR SELECT 
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can rate responses" 
  ON response_ratings FOR INSERT 
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view suggestions" 
  ON prompt_improvement_suggestions FOR SELECT 
  USING (auth.uid() IS NOT NULL);
