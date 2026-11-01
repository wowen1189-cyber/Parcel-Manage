-- The screening company named on an adverse action notice (FCRA 1681m(a)), kept so the notice can be
-- reprinted and mailed when it couldn't be e-mailed.
alter table public.application add column adverse_agency jsonb;
