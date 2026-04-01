INSERT INTO users (email, password, name, is_admin)
VALUES (
  'admin@aether.com',
  '$2b$10$Un/V5JjoZZUM9v6l46dCDOSdWVSbdLE9CzgIUoQjT1YoDJR6ICWaq',
  'System Administrator',
  TRUE
)
ON CONFLICT (email) DO UPDATE
SET password = '$2b$10$Un/V5JjoZZUM9v6l46dCDOSdWVSbdLE9CzgIUoQjT1YoDJR6ICWaq', is_admin = TRUE;