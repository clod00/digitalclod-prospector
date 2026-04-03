-- DigitalClod Prospector — prospect_leads table
-- Run this in Supabase SQL editor

create table if not exists public.prospect_leads (
  id                       uuid primary key default gen_random_uuid(),

  -- Dati base (da import)
  ragione_sociale          text not null,
  piva                     text unique,
  citta                    text,
  settore                  text,
  telefono                 text,
  email_trovata            text,
  indirizzo_fisico         text,
  sito_web                 text,

  -- Website analysis
  sito_esiste              boolean,
  sito_pagespeed           integer,
  sito_ha_pixel            boolean,
  sito_email_provider      text,

  -- Google Maps
  gmaps_stelle             numeric(3,1),
  gmaps_recensioni         integer,
  gmaps_foto               integer,

  -- Social
  social_instagram_url     text,
  social_instagram_follower integer,
  social_facebook_url      text,

  -- Advertising
  fa_ads_attivi            boolean,

  -- Score
  score_totale             integer,
  score_tier               text check (score_tier in ('Hot', 'Warm', 'Cold')),
  score_breakdown          jsonb,

  -- AI Output
  ai_email_template        text,
  ai_whatsapp_hook         text,
  ai_idee_automazione      text,
  ai_oggetto_ab            text,

  -- CRM
  stato                    text default 'da_contattare'
                             check (stato in ('da_contattare', 'contattato', 'risposto', 'cliente')),
  note                     text,

  -- Timestamps
  enriched_at              timestamptz,
  created_at               timestamptz default now()
);

-- Indexes
create index if not exists idx_prospect_leads_tier     on public.prospect_leads (score_tier);
create index if not exists idx_prospect_leads_score    on public.prospect_leads (score_totale desc);
create index if not exists idx_prospect_leads_settore  on public.prospect_leads (settore);
create index if not exists idx_prospect_leads_stato    on public.prospect_leads (stato);
create index if not exists idx_prospect_leads_created  on public.prospect_leads (created_at desc);

-- RLS: disable for service key access (backend uses service key)
alter table public.prospect_leads enable row level security;

-- Allow all for service role (backend)
create policy "Service role full access"
  on public.prospect_leads
  for all
  to service_role
  using (true)
  with check (true);
