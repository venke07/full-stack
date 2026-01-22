/**
 * Prompt Versioning & A/B Testing Module
 * Manages agent prompt versions and A/B testing functionality
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase credentials missing. Set SUPABASE_URL and SUPABASE_KEY in .env');
}

const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

class PromptVersioning {
  /**
   * Create a new prompt version for an agent
   */
  async createPromptVersion(agentId, versionData) {
    if (!supabase) {
      throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_KEY in .env');
    }
    const {
      version_name,
      prompt_text,
      system_prompt,
      description,
      is_active = false,
    } = versionData;

    if (!agentId || !version_name || !prompt_text) {
      throw new Error('agentId, version_name, and prompt_text are required');
    }

    // Get next version number
    const { data: versions } = await supabase
      .from('agent_prompt_versions')
      .select('version_number')
      .eq('agent_id', agentId)
      .order('version_number', { ascending: false })
      .limit(1);

    const version_number = (versions?.[0]?.version_number || 0) + 1;

    // If this is set as active, deactivate all others
    if (is_active) {
      await supabase
        .from('agent_prompt_versions')
        .update({ is_active: false })
        .eq('agent_id', agentId);
    }

    const { data, error } = await supabase
      .from('agent_prompt_versions')
      .insert({
        agent_id: agentId,
        version_number,
        version_name,
        prompt_text,
        system_prompt,
        description,
        is_active,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get all prompt versions for an agent
   */
  async getPromptVersions(agentId) {
    const { data, error } = await supabase
      .from('agent_prompt_versions')
      .select('*')
      .eq('agent_id', agentId)
      .order('version_number', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  /**
   * Get a specific prompt version
   */
  async getPromptVersion(versionId) {
    const { data, error } = await supabase
      .from('agent_prompt_versions')
      .select('*')
      .eq('id', versionId)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get active version for an agent
   */
  async getActiveVersion(agentId) {
    const { data, error } = await supabase
      .from('agent_prompt_versions')
      .select('*')
      .eq('agent_id', agentId)
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // No rows error is OK
    return data || null;
  }

  /**
   * Update a prompt version
   */
  async updatePromptVersion(versionId, updates) {
    const { is_active, ...otherUpdates } = updates;

    // If setting as active, deactivate others first
    if (is_active) {
      const version = await this.getPromptVersion(versionId);
      await supabase
        .from('agent_prompt_versions')
        .update({ is_active: false })
        .eq('agent_id', version.agent_id);
    }

    const { data, error } = await supabase
      .from('agent_prompt_versions')
      .update({ ...otherUpdates, ...(is_active !== undefined && { is_active }) })
      .eq('id', versionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Delete a prompt version
   */
  async deletePromptVersion(versionId) {
    const { error } = await supabase
      .from('agent_prompt_versions')
      .delete()
      .eq('id', versionId);

    if (error) throw error;
    return { success: true };
  }

  /**
   * Create an A/B test session
   */
  async createABTestSession(agentId, testData) {
    const {
      version_a_id,
      version_b_id,
      test_name,
      sample_size = 20,
      notes,
    } = testData;

    if (!agentId || !version_a_id || !version_b_id) {
      throw new Error('agentId, version_a_id, and version_b_id are required');
    }

    if (version_a_id === version_b_id) {
      throw new Error('Version A and B must be different');
    }

    const { data, error } = await supabase
      .from('a_b_test_sessions')
      .insert({
        agent_id: agentId,
        version_a_id,
        version_b_id,
        test_name,
        sample_size,
        notes,
        status: 'active',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get A/B test sessions for an agent
   */
  async getABTestSessions(agentId) {
    try {
      const { data, error } = await supabase
        .from('a_b_test_sessions')
        .select(
          `
          *,
          version_a:agent_prompt_versions!version_a_id(id, version_name, version_number),
          version_b:agent_prompt_versions!version_b_id(id, version_name, version_number)
          `
        )
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching with relationships:', error);
        // Fallback: fetch without relationships
        const { data: sessionsData, error: sessionsError } = await supabase
          .from('a_b_test_sessions')
          .select('*')
          .eq('agent_id', agentId)
          .order('created_at', { ascending: false });

        if (sessionsError) throw sessionsError;

        // Fetch versions separately and attach them
        if (sessionsData && sessionsData.length > 0) {
          const versionIds = new Set();
          sessionsData.forEach(session => {
            versionIds.add(session.version_a_id);
            versionIds.add(session.version_b_id);
          });

          const { data: versionsData } = await supabase
            .from('agent_prompt_versions')
            .select('id, version_name, version_number')
            .in('id', Array.from(versionIds));

          const versionsMap = {};
          versionsData?.forEach(v => {
            versionsMap[v.id] = v;
          });

          return sessionsData.map(session => ({
            ...session,
            version_a: versionsMap[session.version_a_id] || null,
            version_b: versionsMap[session.version_b_id] || null,
          }));
        }

        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getABTestSessions:', error);
      throw error;
    }
  }

  /**
   * Get A/B test session details with results
   */
  async getABTestSessionDetails(sessionId) {
    try {
      const { data, error } = await supabase
        .from('a_b_test_sessions')
        .select(
          `
          *,
          version_a:agent_prompt_versions!version_a_id(*),
          version_b:agent_prompt_versions!version_b_id(*),
          test_results:a_b_test_results(*)
          `
        )
        .eq('id', sessionId)
        .single();

      if (error) {
        console.error('Error fetching session details with relationships:', error);
        // Fallback: fetch without relationships
        const { data: sessionData, error: sessionError } = await supabase
          .from('a_b_test_sessions')
          .select('*')
          .eq('id', sessionId)
          .single();

        if (sessionError) throw sessionError;

        // Fetch versions separately
        const { data: versionA } = await supabase
          .from('agent_prompt_versions')
          .select('*')
          .eq('id', sessionData.version_a_id)
          .single();

        const { data: versionB } = await supabase
          .from('agent_prompt_versions')
          .select('*')
          .eq('id', sessionData.version_b_id)
          .single();

        // Fetch test results
        const { data: testResults } = await supabase
          .from('a_b_test_results')
          .select('*')
          .eq('test_session_id', sessionId);

        return {
          ...sessionData,
          version_a: versionA,
          version_b: versionB,
          test_results: testResults || [],
        };
      }

      return data;
    } catch (error) {
      console.error('Error in getABTestSessionDetails:', error);
      throw error;
    }
  }

  /**
   * Record A/B test result
   */
  async recordTestResult(testSessionId, agentId, versionId, testData) {
    const { user_prompt, agent_response, response_time_ms } = testData;

    const { data, error } = await supabase
      .from('a_b_test_results')
      .insert({
        test_session_id: testSessionId,
        agent_id: agentId,
        version_id: versionId,
        user_prompt,
        agent_response,
        response_time_ms,
      })
      .select()
      .single();

    if (error) throw error;

    // Check if test should be completed
    await this.checkAndCompleteTest(testSessionId);

    return data;
  }

  /**
   * Rate a response
   */
  async rateResponse(agentId, ratingData) {
    const {
      conversation_id,
      test_result_id,
      rating,
      quality_score,
      relevance_score,
      helpfulness_score,
      feedback_text,
    } = ratingData;

    if (!rating || rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const { data, error } = await supabase
      .from('response_ratings')
      .insert({
        agent_id: agentId,
        conversation_id,
        test_result_id,
        rating,
        quality_score,
        relevance_score,
        helpfulness_score,
        feedback_text,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get ratings for a test result
   */
  async getResultRatings(testResultId) {
    const { data, error } = await supabase
      .from('response_ratings')
      .select('*')
      .eq('test_result_id', testResultId);

    if (error) throw error;
    return data || [];
  }

  /**
   * Get statistics for an A/B test
   */
  async getTestStatistics(sessionId) {
    try {
      const { data: testSession, error: sessionError } = await supabase
        .from('a_b_test_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (sessionError) throw sessionError;

      // Get results for both versions - first try with relationships
      let results;
      const { data: resultsData, error: resultsError } = await supabase
        .from('a_b_test_results')
        .select(
          `
          id,
          version_id,
          response_time_ms,
          response_ratings(rating, quality_score, relevance_score, helpfulness_score)
          `
        )
        .eq('test_session_id', sessionId);

      if (resultsError) {
        console.error('Error fetching results with ratings:', resultsError);
        // Fallback: fetch results without relationships
        const { data: fallbackResults, error: fallbackError } = await supabase
          .from('a_b_test_results')
          .select('id, version_id, response_time_ms')
          .eq('test_session_id', sessionId);

        if (fallbackError) throw fallbackError;

        results = fallbackResults;

        // Fetch ratings separately
        if (results && results.length > 0) {
          const resultIds = results.map(r => r.id);
          const { data: ratingsData } = await supabase
            .from('response_ratings')
            .select('test_result_id, rating, quality_score, relevance_score, helpfulness_score')
            .in('test_result_id', resultIds);

          // Attach ratings to results
          const ratingsMap = {};
          ratingsData?.forEach(rating => {
            if (!ratingsMap[rating.test_result_id]) {
              ratingsMap[rating.test_result_id] = [];
            }
            ratingsMap[rating.test_result_id].push({
              rating: rating.rating,
              quality_score: rating.quality_score,
              relevance_score: rating.relevance_score,
              helpfulness_score: rating.helpfulness_score,
            });
          });

          results = results.map(r => ({
            ...r,
            response_ratings: ratingsMap[r.id] || [],
          }));
        }
      } else {
        results = resultsData;
      }

      // Calculate statistics
      const versionAResults = results?.filter(r => r.version_id === testSession.version_a_id) || [];
      const versionBResults = results?.filter(r => r.version_id === testSession.version_b_id) || [];

      const calculateStats = (versionResults) => {
        const totalTests = versionResults.length;
        const avgResponseTime = versionResults.length > 0
          ? versionResults.reduce((sum, r) => sum + (r.response_time_ms || 0), 0) / versionResults.length
          : 0;

        // Get all ratings for this version's results
        const allRatings = versionResults.flatMap(r => r.response_ratings || []);
        const avgRating = allRatings.length > 0
          ? allRatings.reduce((sum, r) => sum + (r.rating || 0), 0) / allRatings.length
          : 0;

        const qualityScores = allRatings.filter(r => r.quality_score !== null && r.quality_score !== undefined);
        const avgQuality = qualityScores.length > 0
          ? qualityScores.reduce((sum, r) => sum + r.quality_score, 0) / qualityScores.length
          : 0;

        const relevanceScores = allRatings.filter(r => r.relevance_score !== null && r.relevance_score !== undefined);
        const avgRelevance = relevanceScores.length > 0
          ? relevanceScores.reduce((sum, r) => sum + r.relevance_score, 0) / relevanceScores.length
          : 0;

        return {
          totalTests,
          avgResponseTime: parseFloat(avgResponseTime.toFixed(2)),
          avgRating: parseFloat(avgRating.toFixed(2)),
          avgQuality: parseFloat(avgQuality.toFixed(3)),
          avgRelevance: parseFloat(avgRelevance.toFixed(3)),
          totalRatings: allRatings.length,
        };
      };

      const statsA = calculateStats(versionAResults);
      const statsB = calculateStats(versionBResults);

      // Determine winner (higher average rating)
      const winner = statsA.avgRating > statsB.avgRating ? 'A' : statsB.avgRating > statsA.avgRating ? 'B' : 'tie';

      return {
        test_session: testSession,
        version_a_stats: statsA,
        version_b_stats: statsB,
        winner,
        total_results: results?.length || 0,
      };
    } catch (error) {
      console.error('Error in getTestStatistics:', error);
      throw error;
    }
  }

  /**
   * Check if test should be completed
   */
  async checkAndCompleteTest(sessionId) {
    const { data: session } = await supabase
      .from('a_b_test_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (!session) return;

    const { data: results } = await supabase
      .from('a_b_test_results')
      .select('id')
      .eq('test_session_id', sessionId);

    const completedTests = results?.length || 0;

    if (completedTests >= session.sample_size && session.status === 'active') {
      // Auto-complete when sample size reached
      const stats = await this.getTestStatistics(sessionId);
      const winnerId = stats.winner === 'A' 
        ? session.version_a_id 
        : stats.winner === 'B' 
        ? session.version_b_id 
        : null;

      await supabase
        .from('a_b_test_sessions')
        .update({
          status: 'completed',
          winner_id: winnerId,
          ended_at: new Date().toISOString(),
          completed_tests: completedTests,
        })
        .eq('id', sessionId);
    }
  }

  /**
   * End an A/B test manually
   */
  async endABTest(sessionId) {
    const stats = await this.getTestStatistics(sessionId);
    const { data: session } = await supabase
      .from('a_b_test_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    const winnerId = stats.winner === 'A' 
      ? session.version_a_id 
      : stats.winner === 'B' 
      ? session.version_b_id 
      : null;

    const { data, error } = await supabase
      .from('a_b_test_sessions')
      .update({
        status: 'completed',
        winner_id: winnerId,
        ended_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Generate improvement suggestions based on test results
   */
  async generateImprovementSuggestions(versionId) {
    const version = await this.getPromptVersion(versionId);
    if (!version) throw new Error('Version not found');

    const { data: ratings } = await supabase
      .from('response_ratings')
      .select('*')
      .from(
        supabase
          .from('a_b_test_results')
          .select('id')
          .eq('version_id', versionId)
      );

    // This would integrate with an AI service to generate suggestions
    // For now, we'll create placeholder suggestions
    const suggestions = [
      {
        suggestion_type: 'clarity',
        suggestion_text: 'Add more specific instructions about the expected output format',
        reasoning: 'Low relevance scores suggest the agent may not understand what you want',
        potential_impact: 'Could improve relevance by 15-20%',
      },
      {
        suggestion_type: 'tone',
        suggestion_text: 'Adjust the tone to be more conversational and less formal',
        reasoning: 'User feedback mentions responses feel robotic',
        potential_impact: 'Could improve helpfulness ratings',
      },
    ];

    for (const suggestion of suggestions) {
      await supabase
        .from('prompt_improvement_suggestions')
        .insert({
          agent_id: version.agent_id,
          version_id: versionId,
          ...suggestion,
        });
    }

    return suggestions;
  }

  /**
   * Get improvement suggestions for a version
   */
  async getImprovementSuggestions(versionId) {
    const { data, error } = await supabase
      .from('prompt_improvement_suggestions')
      .select('*')
      .eq('version_id', versionId)
      .order('generated_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }
}

export default new PromptVersioning();
