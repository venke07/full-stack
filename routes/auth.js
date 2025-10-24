const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Neural Profile Registration (Signup)
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        error: 'Neural profile incomplete',
        message: 'Name, email, and password are required for neural registration.'
      });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({
        error: 'Access key too weak',
        message: 'Neural access key must be at least 6 characters long.'
      });
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          display_name: name,
          neural_id: email,
        }
      }
    });

    if (authError) {
      return res.status(400).json({
        error: 'Neural registration failed',
        message: authError.message
      });
    }

    // Create profile in custom table
    if (authData.user) {
      const { error: profileError } = await supabase
        .from('neural_profiles')
        .insert([
          {
            id: authData.user.id,
            name: name,
            email: email,
            neural_id: email,
            status: 'active',
            created_at: new Date().toISOString(),
            last_login: new Date().toISOString()
          }
        ]);

      if (profileError) {
        console.error('Profile creation error:', profileError);
        // Continue anyway, auth user was created
      }
    }

    res.status(201).json({
      success: true,
      message: `Neural profile initialized for ${name}`,
      user: {
        id: authData.user?.id,
        email: authData.user?.email,
        name: name,
        email_confirmed: !!authData.user?.email_confirmed_at
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      error: 'Neural system malfunction',
      message: 'Internal error during neural profile creation.'
    });
  }
});

// Neural Authentication (Login)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        error: 'Authentication incomplete',
        message: 'Neural ID and access key are required.'
      });
    }

    // Authenticate with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    });

    if (error) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: error.message.includes('Invalid login credentials') 
          ? 'Invalid neural credentials. Please check your Neural ID and access key.'
          : error.message
      });
    }

    // Update last login
    await supabase
      .from('neural_profiles')
      .update({ last_login: new Date().toISOString() })
      .eq('id', data.user.id);

    // Log activity
    await supabase
      .from('neural_activities')
      .insert([
        {
          user_id: data.user.id,
          activity: 'Neural authentication successful',
          activity_type: 'login',
          timestamp: new Date().toISOString()
        }
      ]);

    res.json({
      success: true,
      message: `Neural link established for ${data.user.user_metadata?.display_name || 'Agent'}`,
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata?.display_name,
        neural_id: data.user.user_metadata?.neural_id
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Neural system malfunction',
      message: 'Internal error during authentication.'
    });
  }
});

// Neural Disconnection (Logout)
router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'No neural session',
        message: 'Authorization token required for disconnection.'
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

    // Get current user
    const { data: { user } } = await userSupabase.auth.getUser();
    
    if (user) {
      // Log logout activity
      await supabase
        .from('neural_activities')
        .insert([
          {
            user_id: user.id,
            activity: 'Neural session terminated',
            activity_type: 'logout',
            timestamp: new Date().toISOString()
          }
        ]);
    }

    // Sign out
    const { error } = await userSupabase.auth.signOut();
    
    if (error) {
      console.error('Logout error:', error);
    }

    res.json({
      success: true,
      message: 'Neural connection terminated successfully.'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Neural system malfunction',
      message: 'Internal error during disconnection.'
    });
  }
});

// Verify Neural Session
router.get('/verify', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'No neural session',
        message: 'Authorization token required.'
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
        error: 'Invalid neural session',
        message: 'Session expired or invalid.'
      });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.display_name,
        neural_id: user.user_metadata?.neural_id
      }
    });

  } catch (error) {
    console.error('Session verification error:', error);
    res.status(500).json({
      error: 'Neural system malfunction',
      message: 'Internal error during session verification.'
    });
  }
});

module.exports = router;
