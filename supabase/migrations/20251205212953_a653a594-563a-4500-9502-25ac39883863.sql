-- Create table for storing approved Elliott Wave counts (training data)
CREATE TABLE public.approved_wave_counts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  timeframe TEXT NOT NULL DEFAULT 'daily',
  historical_low JSONB NOT NULL,
  supercycle JSONB NOT NULL,
  confidence NUMERIC(3,2) DEFAULT 0.0,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'manual', -- 'manual', 'ai_approved', 'ai_rejected'
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_reference BOOLEAN DEFAULT false, -- Mark as training reference
  version_number INTEGER DEFAULT 1,
  UNIQUE(symbol, timeframe, user_id, version_number)
);

-- Enable Row Level Security
ALTER TABLE public.approved_wave_counts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own approved counts"
ON public.approved_wave_counts
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own approved counts"
ON public.approved_wave_counts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own approved counts"
ON public.approved_wave_counts
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own approved counts"
ON public.approved_wave_counts
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for automatic timestamp updates
CREATE TRIGGER update_approved_wave_counts_updated_at
BEFORE UPDATE ON public.approved_wave_counts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();