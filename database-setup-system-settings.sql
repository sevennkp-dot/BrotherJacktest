-- Create the system_settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed initial settings
INSERT INTO public.system_settings (key, value, description)
VALUES 
    ('auto_approve_technicians', 'false'::jsonb, 'Automatic approval for new technicians'),
    ('email_notifications', 'true'::jsonb, 'Enable system email notifications'),
    ('maintenance_mode', 'false'::jsonb, 'Enable maintenance mode for the platform')
ON CONFLICT (key) DO NOTHING;

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Allow admins to manage settings
CREATE POLICY "Admins can manage system settings" 
ON public.system_settings 
FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);

-- Allow anyone to read settings (if needed for public app)
CREATE POLICY "Public read access for system settings" 
ON public.system_settings 
FOR SELECT 
TO authenticated 
USING (true);
