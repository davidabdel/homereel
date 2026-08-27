-- Create a table for user media
CREATE TABLE user_media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_type VARCHAR NOT NULL CHECK (media_type IN ('image', 'video')),
  title VARCHAR,
  description TEXT,
  storage_path VARCHAR NOT NULL,
  thumbnail_path VARCHAR,
  content_type VARCHAR,
  size INTEGER,
  width INTEGER,
  height INTEGER,
  duration INTEGER, -- for videos
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Add any other metadata you want to track
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create an index for faster queries by user
CREATE INDEX idx_user_media_user_id ON user_media(user_id);

-- Enable Row Level Security
ALTER TABLE user_media ENABLE ROW LEVEL SECURITY;

-- Create policy for users to access only their own media
CREATE POLICY "Users can access their own media"
  ON user_media
  FOR ALL
  USING (auth.uid() = user_id);

-- Create policy for public access to specific media (if needed)
CREATE POLICY "Public access to published media"
  ON user_media
  FOR SELECT
  USING (metadata->>'visibility' = 'public');

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update the updated_at column
CREATE TRIGGER update_user_media_updated_at
BEFORE UPDATE ON user_media
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
