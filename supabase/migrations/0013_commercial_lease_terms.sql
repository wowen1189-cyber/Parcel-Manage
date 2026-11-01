-- Commercial leases: the deal terms a residential lease doesn't have (permitted use, yearly increase,
-- renewal option, CAM, pro rata utilities, repair threshold). lib/commercial-terms.ts; null on residential leases.
alter table public.lease add column commercial_terms jsonb;
