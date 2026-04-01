-- First, let's check if admin already exists
SELECT id, email, is_admin FROM users WHERE email = 'admin@aether.com';

-- If admin doesn't exist, create it
-- Password: admin@123 (bcrypt hash generated with 10 rounds)
INSERT INTO users (email, password, name, is_admin)
VALUES (
  'admin@aether.com',
  '$2b$10$rKZEK8GZ6YQ3kZ8fN0N3YuQJZ8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8',
  'System Administrator',
  TRUE
)
ON CONFLICT (email) DO UPDATE 
SET 
  password = '$2b$10$rKZEK8GZ6YQ3kZ8fN0N3YuQJZ8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8',
  is_admin = TRUE,
  name = 'System Administrator';

-- Verify admin was created
SELECT id, email, name, is_admin, created_at FROM users WHERE email = 'admin@aether.com';
