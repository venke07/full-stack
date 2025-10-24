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
        message: 'Authorization token required for neural operations.'
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
        message: 'Please re-authenticate to access neural functions.'
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

// Get Neural Nodes
router.get('/nodes', verifyNeuralSession, async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: nodes, error } = await supabase
      .from('neural_nodes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(400).json({
        error: 'Neural node retrieval failed',
        message: error.message
      });
    }

    res.json({
      success: true,
      nodes: nodes || []
    });

  } catch (error) {
    console.error('Neural nodes fetch error:', error);
    res.status(500).json({
      error: 'Neural network malfunction',
      message: 'Unable to retrieve neural node configurations.'
    });
  }
});

// Toggle Neural Node
router.put('/nodes/:nodeName/toggle', verifyNeuralSession, async (req, res) => {
  try {
    const userId = req.user.id;
    const nodeName = decodeURIComponent(req.params.nodeName);

    // Get current node state
    const { data: currentNode, error: fetchError } = await supabase
      .from('neural_nodes')
      .select('*')
      .eq('user_id', userId)
      .eq('node_name', nodeName)
      .single();

    if (fetchError) {
      return res.status(404).json({
        error: 'Neural node not found',
        message: `Unable to locate neural node: ${nodeName}`
      });
    }

    const newState = !currentNode.is_active;

    // Update node state
    const { data: updatedNode, error: updateError } = await supabase
      .from('neural_nodes')
      .update({ 
        is_active: newState,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('node_name', nodeName)
      .select()
      .single();

    if (updateError) {
      return res.status(400).json({
        error: 'Neural node toggle failed',
        message: updateError.message
      });
    }

    // Log activity
    await supabase
      .from('neural_activities')
      .insert([
        {
          user_id: userId,
          activity: `${nodeName} ${newState ? 'activated' : 'deactivated'}`,
          activity_type: 'node_toggle',
          metadata: { 
            node_name: nodeName, 
            previous_state: currentNode.is_active,
            new_state: newState 
          },
          timestamp: new Date().toISOString()
        }
      ]);

    res.json({
      success: true,
      message: `${nodeName} ${newState ? 'activated' : 'deactivated'} successfully.`,
      node: updatedNode
    });

  } catch (error) {
    console.error('Neural node toggle error:', error);
    res.status(500).json({
      error: 'Neural node malfunction',
      message: `Unable to toggle ${req.params.nodeName}.`
    });
  }
});

// Create Custom Neural Node
router.post('/nodes', verifyNeuralSession, async (req, res) => {
  try {
    const userId = req.user.id;
    const { node_name, node_type = 'custom', is_active = false, configuration = {} } = req.body;

    if (!node_name) {
      return res.status(400).json({
        error: 'Neural node data incomplete',
        message: 'Node name is required for neural node creation.'
      });
    }

    // Check if node already exists
    const { data: existingNode } = await supabase
      .from('neural_nodes')
      .select('*')
      .eq('user_id', userId)
      .eq('node_name', node_name)
      .single();

    if (existingNode) {
      return res.status(409).json({
        error: 'Neural node conflict',
        message: `Neural node '${node_name}' already exists.`
      });
    }

    // Create new node
    const { data: newNode, error } = await supabase
      .from('neural_nodes')
      .insert([
        {
          user_id: userId,
          node_name: node_name,
          node_type: node_type,
          is_active: is_active,
          configuration: configuration,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) {
      return res.status(400).json({
        error: 'Neural node creation failed',
        message: error.message
      });
    }

    // Log activity
    await supabase
      .from('neural_activities')
      .insert([
        {
          user_id: userId,
          activity: `Custom neural node '${node_name}' created`,
          activity_type: 'general',
          metadata: { node_name, node_type },
          timestamp: new Date().toISOString()
        }
      ]);

    res.status(201).json({
      success: true,
      message: `Neural node '${node_name}' created successfully.`,
      node: newNode
    });

  } catch (error) {
    console.error('Neural node creation error:', error);
    res.status(500).json({
      error: 'Neural node creation malfunction',
      message: 'Unable to create new neural node.'
    });
  }
});

// Update Neural Node Configuration
router.put('/nodes/:nodeName/config', verifyNeuralSession, async (req, res) => {
  try {
    const userId = req.user.id;
    const nodeName = decodeURIComponent(req.params.nodeName);
    const { configuration = {} } = req.body;

    const { data: updatedNode, error } = await supabase
      .from('neural_nodes')
      .update({ 
        configuration: configuration,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('node_name', nodeName)
      .select()
      .single();

    if (error) {
      return res.status(400).json({
        error: 'Neural node configuration failed',
        message: error.message
      });
    }

    // Log activity
    await supabase
      .from('neural_activities')
      .insert([
        {
          user_id: userId,
          activity: `${nodeName} configuration updated`,
          activity_type: 'general',
          metadata: { node_name: nodeName, configuration },
          timestamp: new Date().toISOString()
        }
      ]);

    res.json({
      success: true,
      message: `${nodeName} configuration updated successfully.`,
      node: updatedNode
    });

  } catch (error) {
    console.error('Neural node config error:', error);
    res.status(500).json({
      error: 'Neural configuration malfunction',
      message: `Unable to update ${req.params.nodeName} configuration.`
    });
  }
});

// Delete Custom Neural Node
router.delete('/nodes/:nodeName', verifyNeuralSession, async (req, res) => {
  try {
    const userId = req.user.id;
    const nodeName = decodeURIComponent(req.params.nodeName);

    // Check if it's a default node (prevent deletion)
    const defaultNodes = [
      'Language Processing',
      'Vision System', 
      'Decision Engine',
      'Memory Banks',
      'Learning Core',
      'Communication Hub'
    ];

    if (defaultNodes.includes(nodeName)) {
      return res.status(403).json({
        error: 'Neural core protection',
        message: 'Default neural nodes cannot be deleted for system stability.'
      });
    }

    const { error } = await supabase
      .from('neural_nodes')
      .delete()
      .eq('user_id', userId)
      .eq('node_name', nodeName);

    if (error) {
      return res.status(400).json({
        error: 'Neural node deletion failed',
        message: error.message
      });
    }

    // Log activity
    await supabase
      .from('neural_activities')
      .insert([
        {
          user_id: userId,
          activity: `Custom neural node '${nodeName}' deleted`,
          activity_type: 'general',
          metadata: { node_name: nodeName },
          timestamp: new Date().toISOString()
        }
      ]);

    res.json({
      success: true,
      message: `Neural node '${nodeName}' deleted successfully.`
    });

  } catch (error) {
    console.error('Neural node deletion error:', error);
    res.status(500).json({
      error: 'Neural node deletion malfunction',
      message: `Unable to delete ${req.params.nodeName}.`
    });
  }
});

module.exports = router;
