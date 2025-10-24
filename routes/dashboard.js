const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Middleware to verify neural session
const verifyNeuralSession = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Neural access denied',
        message: 'Authorization token required for dashboard access.'
      });
    }

    const token = authHeader.substring(7);
    
    // Create a temporary supabase client with the user's token
    const userSupabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }
    );

    const { data: { user }, error } = await userSupabase.auth.getUser();
    
    if (error || !user) {
      return res.status(401).json({
        error: 'Neural session expired',
        message: 'Please re-authenticate to access the neural dashboard.'
      });
    }

    req.user = user;
    req.userSupabase = userSupabase;
    next();

  } catch (error) {
    console.error('Session verification error:', error);
    res.status(500).json({
      error: 'Neural system malfunction',
      message: 'Internal error during session verification.'
    });
  }
};

// Get Neural Dashboard Data
router.get('/stats', verifyNeuralSession, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get neural profile
    const { data: profile, error: profileError } = await supabase
      .from('neural_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) {
      return res.status(404).json({
        error: 'Neural profile not found',
        message: 'Unable to locate neural profile data.'
      });
    }

    // Get neural nodes
    const { data: nodes, error: nodesError } = await supabase
      .from('neural_nodes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (nodesError) {
      console.error('Nodes fetch error:', nodesError);
    }

    // Get recent activities
    const { data: activities, error: activitiesError } = await supabase
      .from('neural_activities')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(10);

    if (activitiesError) {
      console.error('Activities fetch error:', activitiesError);
    }

    // Calculate stats
    const totalNodes = nodes?.length || 0;
    const activeNodes = nodes?.filter(node => node.is_active).length || 0;
    const totalActivities = activities?.length || 0;

    res.json({
      success: true,
      dashboard: {
        profile: {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          neural_id: profile.neural_id,
          status: profile.status,
          last_login: profile.last_login,
          created_at: profile.created_at
        },
        stats: {
          neural_core_efficiency: Math.min(98.7 + Math.random() * 1.3, 100),
          active_agents: activeNodes,
          total_nodes: totalNodes,
          processing_load: Math.floor(Math.random() * 40 + 50), // 50-90%
          quantum_sync: 'SECURE',
          total_activities: totalActivities
        },
        nodes: nodes || [],
        recent_activities: activities || []
      }
    });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      error: 'Neural dashboard malfunction',
      message: 'Unable to retrieve dashboard statistics.'
    });
  }
});

// Get Neural Activities
router.get('/activities', verifyNeuralSession, async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 20;

    const { data: activities, error } = await supabase
      .from('neural_activities')
      .select('*')
      .eq('user_id', userId)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      return res.status(400).json({
        error: 'Activity retrieval failed',
        message: error.message
      });
    }

    res.json({
      success: true,
      activities: activities || []
    });

  } catch (error) {
    console.error('Activities fetch error:', error);
    res.status(500).json({
      error: 'Neural activity log malfunction',
      message: 'Unable to retrieve neural activities.'
    });
  }
});

// Log Neural Activity
router.post('/activity', verifyNeuralSession, async (req, res) => {
  try {
    const userId = req.user.id;
    const { activity, activity_type = 'general', metadata = {} } = req.body;

    if (!activity) {
      return res.status(400).json({
        error: 'Activity data incomplete',
        message: 'Activity description is required.'
      });
    }

    const { data, error } = await supabase
      .from('neural_activities')
      .insert([
        {
          user_id: userId,
          activity: activity,
          activity_type: activity_type,
          metadata: metadata,
          timestamp: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) {
      return res.status(400).json({
        error: 'Activity logging failed',
        message: error.message
      });
    }

    res.json({
      success: true,
      message: 'Neural activity logged successfully.',
      activity: data
    });

  } catch (error) {
    console.error('Activity logging error:', error);
    res.status(500).json({
      error: 'Neural activity logger malfunction',
      message: 'Unable to log neural activity.'
    });
  }
});

module.exports = router;
