-- Add missing columns to user_preferences table
ALTER TABLE user_preferences 
ADD COLUMN IF NOT EXISTS pressure_unit VARCHAR(10) DEFAULT 'hpa',
ADD COLUMN IF NOT EXISTS precipitation_unit VARCHAR(10) DEFAULT 'mm',
ADD COLUMN IF NOT EXISTS time_format VARCHAR(10) DEFAULT '24h',
ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT TRUE;
