-- Work orders created through the public API or MCP server are marked as such.
alter table public.work_order drop constraint work_order_source_check;
alter table public.work_order add constraint work_order_source_check check (source in ('portal', 'phone', 'email', 'staff', 'recurring', 'inspection', 'api'));
