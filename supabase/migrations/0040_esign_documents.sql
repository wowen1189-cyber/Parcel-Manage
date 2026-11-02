-- E-sign any PDF (E-sign screen): the uploaded file is the document; its SHA-256 is the fingerprint and the
-- signed copy is the original with a signature certificate page added. snapshot is empty for these.
alter table public.signature_request add column source_path text;
alter table public.signature_signer drop constraint signature_signer_role_check;
alter table public.signature_signer add constraint signature_signer_role_check check (role in ('tenant', 'guarantor', 'agent', 'owner', 'signer'));
