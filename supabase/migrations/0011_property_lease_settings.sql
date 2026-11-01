-- Per-property lease settings: the office-set checkboxes and blanks from SIM REI's lease (who handles the
-- repair deductible, lawn, irrigation and pest control; utilities and keys; where deposits are held;
-- the owner's flood and lead-paint answers). Leases at the property fill in from these.
alter table public.property add column lease_settings jsonb not null default '{}'::jsonb;
