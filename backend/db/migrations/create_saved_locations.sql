-- Create saved_locations table with all required columns
CREATE TABLE IF NOT EXISTS saved_locations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    location_name VARCHAR(255) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_saved_locations_user ON saved_locations(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_locations_primary ON saved_locations(user_id, is_primary);

-- Display confirmation
SELECT 'saved_locations table created successfully!' as message;