import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import weatherRoutes from './routes/weather.js';
import { errorHandler } from './middleware/errorHandler.js';
import emailRoutes from './src/routes/email.js'; // FIXED: Correct path
import adminRoutes from './routes/admin.js';
import analyticsRoutes from './routes/analytics.js';
import ticketsRoutes from './routes/tickets.js';



// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Test database connection on startup
import pool from './config/database.js';

(async () => {
  try {
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Database connected successfully');
    console.log(`📅 Server time: ${result.rows[0].now}`);
  } catch (err) {
    // Log error details server-side only
    console.error('❌ Database connection failed');
    console.error('Error:', err.message);
    
    // Provide troubleshooting hints
    console.error('');
    console.error('🔧 Troubleshooting:');
    
    if (err.message.includes('does not exist') && err.message.includes('role')) {
      console.error(`   1. The database user "${process.env.DB_USER}" does not exist`);
      console.error('   2. Check DB_USER in backend/.env file');
      console.error('   3. Common usernames: postgres, root');
      console.error('   4. Create user: psql -U postgres -c "CREATE USER your_username;"');
    } else if (err.code === 'ECONNREFUSED') {
      console.error('   1. PostgreSQL is not running');
      console.error('   2. Start it: net start postgresql-x64-14 (Windows)');
    } else if (err.code === '3D000') {
      console.error(`   1. Database "${process.env.DB_NAME}" does not exist`);
      console.error(`   2. Create it: psql -U postgres -c "CREATE DATABASE ${process.env.DB_NAME};"`);
    }
    
    console.error('');
    console.error('⚠️  Server will continue but database operations will fail');
    console.error('');
  }
})();

// =============================================================================
// MIDDLEWARE
// =============================================================================

// CORS Configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware (development only)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// =============================================================================
// ROUTES
// =============================================================================

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/email', emailRoutes); 
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/admin', adminRoutes); 
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/analytics', analyticsRoutes); 
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/tickets', ticketsRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// =============================================================================
// ERROR HANDLING
// =============================================================================

app.use(errorHandler);

// =============================================================================
// SERVER START
// =============================================================================

app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode`);
  console.log(`📡 Listening on port ${PORT}`);
  console.log(`🌐 API: http://localhost:${PORT}/api`);
  console.log('='.repeat(50));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});
