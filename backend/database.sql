-- Drop existing tables if they exist (for clean reinstall)
DROP TABLE IF EXISTS weather_alerts CASCADE;
DROP TABLE IF EXISTS saved_locations CASCADE;
DROP TABLE IF EXISTS user_preferences CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on email for faster lookups
CREATE INDEX idx_users_email ON users(email);

-- Create user_preferences table (for future use)
CREATE TABLE user_preferences (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    preferred_location VARCHAR(255),
    temperature_unit VARCHAR(10) DEFAULT 'celsius',
    wind_speed_unit VARCHAR(10) DEFAULT 'kmh',
    theme VARCHAR(20) DEFAULT 'dark',
    pressure_unit VARCHAR(10) DEFAULT 'hpa',
    precipitation_unit VARCHAR(10) DEFAULT 'mm',
    time_format VARCHAR(10) DEFAULT '24h',
    notifications_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Create saved_locations table
CREATE TABLE saved_locations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    location_name VARCHAR(255) NOT NULL,
    latitude DECIMAL(9, 6) NOT NULL,
    longitude DECIMAL(9, 6) NOT NULL,
    is_favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, latitude, longitude)
);

-- Create weather_alerts table (for future use)
CREATE TABLE weather_alerts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    location_id INTEGER REFERENCES saved_locations(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL,
    threshold_value DECIMAL(10, 2),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Update saved_locations table to add rank column if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name='saved_locations' 
        AND column_name='rank'
    ) THEN
        ALTER TABLE saved_locations ADD COLUMN rank INTEGER DEFAULT 0;
    END IF;
END $$;

-- Create index on user_id and rank for faster queries
CREATE INDEX IF NOT EXISTS idx_saved_locations_user_rank ON saved_locations(user_id, rank);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_weather_alerts_updated_at BEFORE UPDATE ON weather_alerts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert a test user (password is 'password123')
INSERT INTO users (email, password, name) VALUES 
('test@example.com', '$2b$10$rKZEK8GZ6YQ3kZ8fN0N3YuQJZ8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z8Z', 'Test User');

-- Display success message
SELECT 'Database schema created successfully!' as message;
SELECT 'Tables created:' as info;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
