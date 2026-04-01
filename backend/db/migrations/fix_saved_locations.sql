-- Add is_primary column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'saved_locations' 
        AND column_name = 'is_primary'
    ) THEN
        ALTER TABLE saved_locations 
        ADD COLUMN is_primary BOOLEAN DEFAULT FALSE;
        
        RAISE NOTICE 'Column is_primary added successfully';
    ELSE
        RAISE NOTICE 'Column is_primary already exists';
    END IF;
END $$;

-- Recreate the index (it will skip if exists)
CREATE INDEX IF NOT EXISTS idx_saved_locations_primary ON saved_locations(user_id, is_primary);

-- Display confirmation
SELECT 'saved_locations table fixed successfully!' as message;

-- Verify the structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'saved_locations'
ORDER BY ordinal_position;