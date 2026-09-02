CREATE TABLE IF NOT EXISTS public.os_principios (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    texto text NOT NULL,
    orden integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS pero sin politicas, porque la app se conecta como service_role
ALTER TABLE public.os_principios ENABLE ROW LEVEL SECURITY;
