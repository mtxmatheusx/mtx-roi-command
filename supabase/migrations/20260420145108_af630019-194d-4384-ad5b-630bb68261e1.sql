-- ═══════════════════════════════════════════════════════════════════
-- E-commerce integration: Nuvemshop OAuth + UTM sales tracking
-- ═══════════════════════════════════════════════════════════════════

-- 1. Connections table (one per profile/store)
CREATE TABLE IF NOT EXISTS public.ecommerce_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  profile_id UUID NOT NULL,
  platform TEXT NOT NULL DEFAULT 'nuvemshop',           -- nuvemshop | shopify | yampi (extensível)
  store_id TEXT,                                         -- ID da loja na plataforma (Nuvemshop user_id)
  store_name TEXT,
  store_url TEXT,
  access_token TEXT,                                     -- token OAuth permanente da Nuvemshop
  refresh_token TEXT,                                    -- caso plataforma exija
  token_expires_at TIMESTAMP WITH TIME ZONE,
  scope TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  last_sync_status TEXT,                                 -- success | error | running
  last_sync_error TEXT,
  orders_synced INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (profile_id, platform)
);

ALTER TABLE public.ecommerce_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own ecommerce connections"
  ON public.ecommerce_connections
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_ecommerce_connections_updated_at
  BEFORE UPDATE ON public.ecommerce_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- 2. UTM Sales table (one row per order, with extracted UTMs)
CREATE TABLE IF NOT EXISTS public.utm_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  profile_id UUID NOT NULL,
  connection_id UUID NOT NULL REFERENCES public.ecommerce_connections(id) ON DELETE CASCADE,
  platform TEXT NOT NULL DEFAULT 'nuvemshop',
  external_order_id TEXT NOT NULL,                       -- ID do pedido na plataforma
  order_number TEXT,
  order_status TEXT,                                     -- paid | pending | cancelled | refunded
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BRL',
  customer_email TEXT,
  -- UTM parameters
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  -- meta
  landing_page TEXT,
  referrer TEXT,
  ordered_at TIMESTAMP WITH TIME ZONE NOT NULL,
  raw_payload JSONB,                                     -- pedido completo da API
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (connection_id, external_order_id)
);

ALTER TABLE public.utm_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own utm sales"
  ON public.utm_sales
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_utm_sales_updated_at
  BEFORE UPDATE ON public.utm_sales
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Indexes for fast UTM aggregation queries
CREATE INDEX IF NOT EXISTS idx_utm_sales_profile_ordered
  ON public.utm_sales (profile_id, ordered_at DESC);
CREATE INDEX IF NOT EXISTS idx_utm_sales_source
  ON public.utm_sales (profile_id, utm_source);
CREATE INDEX IF NOT EXISTS idx_utm_sales_campaign
  ON public.utm_sales (profile_id, utm_campaign);
CREATE INDEX IF NOT EXISTS idx_utm_sales_status
  ON public.utm_sales (profile_id, order_status);