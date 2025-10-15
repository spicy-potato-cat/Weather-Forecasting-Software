-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
    id SERIAL PRIMARY KEY,
    hazard_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    score INTEGER NOT NULL,
    cell_key VARCHAR(50) NOT NULL,
    details TEXT,
    area_geojson JSONB,
    start_time TIMESTAMP DEFAULT NOW(),
    end_time TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS alert_subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    locations JSONB NOT NULL,
    hazards JSONB DEFAULT '["FLOOD","WIND","HEAT"]',
    opted_in BOOLEAN DEFAULT TRUE,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Authority contacts table
CREATE TABLE IF NOT EXISTS authority_contacts (
    id SERIAL PRIMARY KEY,
    region_id VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Send log table
CREATE TABLE IF NOT EXISTS send_log (
    id SERIAL PRIMARY KEY,
    alert_id INTEGER REFERENCES alerts(id) ON DELETE CASCADE,
    recipient_type VARCHAR(20) NOT NULL,
    recipient_contact VARCHAR(255) NOT NULL,
    channel VARCHAR(20) DEFAULT 'email',
    status VARCHAR(20) DEFAULT 'queued',
    attempt_count INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMP,
    response JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_alerts_cell_key ON alerts(cell_key);
CREATE INDEX idx_alerts_status ON alerts(status);
CREATE INDEX idx_subscriptions_email ON alert_subscriptions(email);
CREATE INDEX idx_send_log_alert_id ON send_log(alert_id);
CREATE INDEX idx_send_log_status ON send_log(status);

-- Insert sample authority contact
INSERT INTO authority_contacts (region_id, name, email, phone, notes)
VALUES ('GLOBAL', 'Emergency Operations Center', 'eoc@example.com', '+1-555-1234', 'Global emergency contact')
ON CONFLICT DO NOTHING;