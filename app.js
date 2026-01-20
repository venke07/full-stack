// ...existing code...
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const neuralRoutes = require('./routes/neural');
const agentRoutes = require('./routes/agentRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const messageRoutes = require('./routes/messagesRoutes');
const searchRoutes = require('./routes/searchRoutes');
const venkeRoutes = require('./routes/venkeRoutes');
const summaryRoutes = require("./routes/summaryRoutes");


const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.skypack.dev"],
      connectSrc: ["'self'", "https://czqywmnordnnnvopeszm.supabase.co", "wss://czqywmnordnnnvopeszm.supabase.co"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Neural network overload. Too many requests, please try again later.'
  }
});
app.use(limiter);

// More strict rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 auth requests per windowMs
  message: {
    error: 'Neural authentication overload. Too many attempts, please try again later.'
  }
});

// Middleware
app.use(compression());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://venke07.github.io', 'https://your-domain.com'] 
    : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001'],
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Handle email verification routes - multiple possible URLs
app.get('/auth/confirm', (req, res) => {
  res.redirect('/email-confirmed.html?' + req.url.split('?')[1] || '');
});

app.get('/auth/callback', (req, res) => {
  res.redirect('/email-confirmed.html?' + req.url.split('?')[1] || '');
});

// Handle any auth-related routes
app.get('/auth/*', (req, res) => {
  res.redirect('/email-confirmed.html?' + req.url.split('?')[1] || '');
});

// API Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/neural', neuralRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/message', messageRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/venke', venkeRoutes);
app.use("/api/summary", summaryRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'Neural Core Online',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Database connectivity test endpoint
app.get('/api/test/database', async (req, res) => {
  const { createClient } = require('@supabase/supabase-js');
  
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Test 1: Check if we can connect to Supabase
    const { data: connectionTest, error: connectionError } = await supabase
      .from('neural_profiles')
      .select('count', { count: 'exact', head: true });

    if (connectionError) {
      return res.status(500).json({
        success: false,
        error: 'Database connection failed',
        details: connectionError.message,
        tests: {
          connection: '❌ FAILED',
          tables: '❌ NOT TESTED',
          auth: '❌ NOT TESTED'
        }
      });
    }

    // Test 2: Check all required tables exist
    const tableTests = {};
    const requiredTables = ['neural_profiles', 'neural_activities', 'neural_nodes', 'neural_sessions'];
    
    for (const table of requiredTables) {
      try {
        const { error } = await supabase
          .from(table)
          .select('count', { count: 'exact', head: true });
        
        tableTests[table] = error ? '❌ MISSING' : '✅ EXISTS';
      } catch (err) {
        tableTests[table] = '❌ ERROR';
      }
    }

    // Test 3: Check if RLS is enabled (by trying to access without auth)
    const { error: rlsTest } = await supabase
      .from('neural_profiles')
      .select('*')
      .limit(1);

    const rlsStatus = rlsTest && rlsTest.message.includes('Row Level Security') 
      ? '✅ ENABLED' 
      : '⚠️ DISABLED';

    res.json({
      success: true,
      message: 'Database connectivity test completed',
      tests: {
        connection: '✅ SUCCESS',
        supabase_url: process.env.SUPABASE_URL ? '✅ CONFIGURED' : '❌ MISSING',
        supabase_key: process.env.SUPABASE_ANON_KEY ? '✅ CONFIGURED' : '❌ MISSING',
        row_level_security: rlsStatus,
        tables: tableTests
      },
      summary: {
        total_tables: requiredTables.length,
        existing_tables: Object.values(tableTests).filter(status => status === '✅ EXISTS').length
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Database test failed',
      details: error.message,
      tests: {
        connection: '❌ FAILED',
        tables: '❌ NOT TESTED',
        auth: '❌ NOT TESTED'
      }
    });
  }
});

// Integrate user's history page routes (added, do not modify existing handlers)
// If SERVE_HISTORY=true the history page will be served as the root before the default index.html handler.
if (process.env.SERVE_HISTORY === 'true') {
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'HTML', 'history.html'));
  });
}

// Serve static files (CSS, JS) for search-history
app.use('/search-history', express.static(path.join(__dirname, 'public', 'search-history', 'public')));

// Serve the standalone history page
app.get('/history', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'search-history', 'public', 'HTML', 'history.html'));
});


// Serve login page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login', 'index.html'));
});

// Serve signup page
app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'signup', 'index.html'));
});

// Serve dashboard page
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});


// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'Neural pathway not found',
    message: 'The requested API endpoint does not exist in the neural network.',
    timestamp: new Date().toISOString()
  });
});

// 404 handler for web pages
app.use('*', (req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Neural system error:', err.stack);
  
  res.status(err.status || 500).json({
    error: 'Neural system malfunction',
    message: process.env.NODE_ENV === 'production' 
      ? 'An internal error occurred in the neural network.' 
      : err.message,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`
  🧠 Neural AI Portal Server Started
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🌐 Server: http://localhost:${PORT}
  🔥 Environment: ${process.env.NODE_ENV || 'development'}
  ⚡ Neural Core: ONLINE
  🚀 Ready for neural connections...
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
});

module.exports = app;
// ...existing code...