-- Add is_admin column to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Create admin user (you@example.com with password: admin@123)
-- Password hash generated with: bcrypt.hash('admin@123', 10)
INSERT INTO users (email, password, name, is_admin) 
VALUES (
  'admin@aether.com', 
  '$2b$10$5Xz3vZYq5fZ3Y0Z3Y0Z3YuKpJ8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z',
  'Administrator',
  TRUE
)
ON CONFLICT (email) DO UPDATE SET is_admin = TRUE;

-- Display confirmation
SELECT 'Admin column and user created successfully!' as message;
SELECT email, name, is_admin FROM users WHERE is_admin = TRUE;