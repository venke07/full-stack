-- Migration: Add Conversation Memory Tables
-- Enables persistent chat history and agent memory
-- Run this migration on Supabase to enable conversation storage

-- Create conversation_history table
CREATE TABLE IF NOT EXISTS public.conversation_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL,
  messages jsonb NOT NULL DEFAULT '[]',
  message_count integer DEFAULT 0,
  summary text,
  tags text[] DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Create conversation_messages table for detailed message tracking
CREATE TABLE IF NOT EXISTS public.conversation_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.conversation_history(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_conversation_history_user_id ON public.conversation_history(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_history_agent_id ON public.conversation_history(agent_id);
CREATE INDEX IF NOT EXISTS idx_conversation_history_created_at ON public.conversation_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_id ON public.conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_user_id ON public.conversation_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_agent_id ON public.conversation_messages(agent_id);

-- Enable Row Level Security
ALTER TABLE public.conversation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for conversation_history
CREATE POLICY "Users can view their own conversations" ON public.conversation_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create conversations" ON public.conversation_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their conversations" ON public.conversation_history
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their conversations" ON public.conversation_history
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for conversation_messages
CREATE POLICY "Users can view their own messages" ON public.conversation_messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create messages" ON public.conversation_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversation_history
  SET updated_at = timezone('utc'::text, now())
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update conversation timestamp when messages are added
CREATE TRIGGER update_conversation_timestamp
AFTER INSERT ON public.conversation_messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_updated_at();
