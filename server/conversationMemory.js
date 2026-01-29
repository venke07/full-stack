/**
 * Conversation Memory Manager
 * Handles storing and retrieving chat history from database
 * Allows agents to have context from previous conversations
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

class ConversationMemory {
  /**
   * Save a conversation to database
   */
  async saveConversation(userId, agentId, messages, conversationData = {}) {
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from('conversation_history')
        .insert([
          {
            user_id: userId,
            agent_id: agentId,
            messages: messages,
            message_count: messages.length,
            summary: conversationData.summary || this.generateSummary(messages),
            tags: conversationData.tags || [],
            metadata: conversationData.metadata || {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (error) {
        console.warn('Failed to save conversation:', error.message);
        return null;
      }

      return data;
    } catch (err) {
      console.error('Error saving conversation:', err);
      return null;
    }
  }

  /**
   * Save individual message to conversation
   */
  async saveMessage(userId, agentId, conversationId, message) {
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from('conversation_messages')
        .insert([
          {
            conversation_id: conversationId,
            user_id: userId,
            agent_id: agentId,
            role: message.role,
            content: message.content || message.text,
            metadata: message.metadata || {},
            created_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (error) {
        console.warn('Failed to save message:', error.message);
        return null;
      }

      return data;
    } catch (err) {
      console.error('Error saving message:', err);
      return null;
    }
  }

  /**
   * Get all conversations for a user and agent
   */
  async getConversations(userId, agentId, limit = 50) {
    if (!supabase) return [];

    try {
      const query = supabase
        .from('conversation_history')
        .select('id, messages, summary, message_count, tags, created_at, updated_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (agentId) {
        query.eq('agent_id', agentId);
      }

      const { data, error } = await query;

      if (error) {
        console.warn('Failed to fetch conversations:', error.message);
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('Error fetching conversations:', err);
      return [];
    }
  }

  /**
   * Get a specific conversation with all messages
   */
  async getConversation(conversationId) {
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from('conversation_history')
        .select('*, conversation_messages(*)')
        .eq('id', conversationId)
        .single();

      if (error) {
        console.warn('Failed to fetch conversation:', error.message);
        return null;
      }

      return data;
    } catch (err) {
      console.error('Error fetching conversation:', err);
      return null;
    }
  }

  /**
   * Get recent messages for context (limit to most recent N messages)
   */
  async getRecentContext(userId, agentId, limit = 10) {
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('conversation_messages')
        .select('role, content, created_at')
        .eq('user_id', userId)
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.warn('Failed to fetch context:', error.message);
        return [];
      }

      // Reverse to get chronological order
      return (data || []).reverse();
    } catch (err) {
      console.error('Error fetching recent context:', err);
      return [];
    }
  }

  /**
   * Search conversations by keyword
   */
  async searchConversations(userId, agentId, keyword) {
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('conversation_history')
        .select('id, messages, summary, created_at')
        .eq('user_id', userId)
        .eq('agent_id', agentId)
        .textSearch('summary', keyword, { type: 'websearch' })
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Failed to search conversations:', error.message);
        return [];
      }

      return data || [];
    } catch (err) {
      console.error('Error searching conversations:', err);
      return [];
    }
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(conversationId) {
    if (!supabase) return false;

    try {
      // Delete messages first
      await supabase
        .from('conversation_messages')
        .delete()
        .eq('conversation_id', conversationId);

      // Delete conversation
      const { error } = await supabase
        .from('conversation_history')
        .delete()
        .eq('id', conversationId);

      if (error) {
        console.warn('Failed to delete conversation:', error.message);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Error deleting conversation:', err);
      return false;
    }
  }

  /**
   * Generate summary from messages
   */
  generateSummary(messages) {
    if (!messages || messages.length === 0) return '';

    // Get first user message and last agent message for summary
    const firstUserMessage = messages.find(m => m.role === 'user' || m.role === 'user');
    const lastMessage = messages[messages.length - 1];

    if (firstUserMessage) {
      const userText = firstUserMessage.content || firstUserMessage.text || '';
      return userText.substring(0, 100) + (userText.length > 100 ? '...' : '');
    }

    return 'Conversation';
  }

  /**
   * Build context from previous conversations to inject into system prompt
   */
  buildContextFromMemory(recentMessages) {
    if (!recentMessages || recentMessages.length === 0) {
      return '';
    }

    const context = recentMessages
      .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n');

    return `\n\n## Previous Context:\n${context}`;
  }
}

export default new ConversationMemory();
