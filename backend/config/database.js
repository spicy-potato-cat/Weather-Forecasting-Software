import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// PostgreSQL connection pool configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || '', // Empty string if no password
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection
pool.on('connect', () => {
  if (process.env.NODE_ENV === 'development') {
    console.log('Database connected successfully');
  }
});

pool.on('error', (err) => {
  // Log error server-side only, don't expose to client
  console.error('Database pool error:', err.message);
  
  if (err.code === 'ECONNREFUSED') {
    console.error('PostgreSQL is not running. Start it with:');
    console.error('   Windows: net start postgresql-x64-14');
  } else if (err.code === '28P01') {
    console.error('Authentication failed. Check DB_USER and DB_PASSWORD in .env');
  } else if (err.code === '3D000') {
    console.error(`Database "${process.env.DB_NAME}" does not exist`);
  }
});

// Query helper function with proper error messages
export const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`🗄️  Query executed in ${duration}ms`);
    }
    
    return res;
  } catch (error) {
    // Log detailed error server-side
    console.error('❌ Database query error:', error.message);
    console.error('Error code:', error.code);
    console.error('Query:', text);
    console.error('Params:', params);
    
    // Provide helpful hints server-side only
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 PostgreSQL is not running');
    } else if (error.code === '3D000') {
      console.error(`💡 Database "${process.env.DB_NAME}" does not exist`);
    } else if (error.code === '28P01') {
      console.error('💡 Authentication failed - check credentials');
    } else if (error.code === '28000') {
      console.error('💡 Role does not exist - check DB_USER in .env');
    } else if (error.code === '42703') {
      console.error('💡 Column does not exist - run database migrations');
    } else if (error.code === '42P01') {
      console.error('💡 Table does not exist - run database.sql schema');
    }
    
    // Re-throw the original error instead of creating a generic one
    throw error;
  }
};

// Get a client from the pool (for transactions)
export const getClient = () => pool.connect();

export default pool;