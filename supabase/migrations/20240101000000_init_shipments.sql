-- Enable the unaccent extension for Turkish character support
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Create the shipments table
CREATE TABLE IF NOT EXISTS shipments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tracking_code TEXT NOT NULL,
    recipient_name TEXT NOT NULL,
    recipient_phone_last4 VARCHAR(4),
    carrier TEXT DEFAULT 'Yurtiçi Kargo' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    status TEXT DEFAULT 'active' NOT NULL
);

-- Add an index to tracking_code for faster lookups
CREATE INDEX IF NOT EXISTS shipments_tracking_code_idx ON shipments(tracking_code);

-- Create a helper function to perform case-insensitive and accent-insensitive search
-- Usage: SELECT * FROM search_shipments_by_name('alıcı adı');
CREATE OR REPLACE FUNCTION search_shipments_by_name(search_term TEXT)
RETURNS SETOF shipments
LANGUAGE sql
AS $$
    SELECT *
    FROM shipments
    WHERE unaccent(recipient_name) ILIKE unaccent('%' || search_term || '%');
$$;
