-- Texting through Twilio (Wesley Owen, Nov 3, 2026). Each company texts from its own number on Parcel Manage's
-- Twilio account. Until an admin turns on "Send real texts", every text is practice: saved and shown, never sent.
-- Texts go only to people who agreed (contact.sms_opt_in, from 0001); a STOP reply turns them off.

alter table public.company add column sms_from_number text;   -- E.164, e.g. +13525550100
alter table public.company add column sms_alert_number text;  -- E.164: who gets emergency repair texts
alter table public.company add column sms_live boolean not null default false;
create unique index company_sms_from_number_key on public.company (sms_from_number) where sms_from_number is not null;

-- Last 10 digits of the mobile number, to match an incoming text to the person who sent it.
alter table public.contact add column mobile_digits text generated always as (nullif(right(regexp_replace(coalesce(mobile, ''), '\D', '', 'g'), 10), '')) stored;
create index on public.contact (company_id, mobile_digits) where mobile_digits is not null;

-- Delivery updates from Twilio find the text by its Twilio id. Job texts to vendors and emergency alerts link
-- to their work order.
create index on public.message (provider_ref) where provider_ref is not null;
alter table public.message add column work_order_id uuid references public.work_order(id) on delete set null;
