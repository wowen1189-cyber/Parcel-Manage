-- A full property management chart of accounts (Wesley Owen, Nov 3, 2026). Every company starts with the
-- standard list below and can add its own accounts, rename them, and hide ones it doesn't use. Existing
-- numbers keep their meaning, so nothing already posted moves.
--
-- section   heading the account is listed under (dropdowns, Settings › Accounts)
-- tax_line  the IRS Schedule E line an income or expense account belongs on (the Schedule E report)
-- system    Parcel Manage posts to it on its own (rent, deposits, fees, owner money): can be renamed, not hidden
-- active    hidden accounts stay in the books and reports but aren't offered for new entries

alter table public.gl_account
  add column section text,
  add column tax_line text,
  add column system boolean not null default false,
  add column active boolean not null default true;

create or replace function public.ensure_chart_of_accounts(p_company uuid) returns void
language plpgsql security invoker set search_path = public as $$
begin
  insert into public.gl_account (company_id, number, name, type, is_trust, section, tax_line, system)
  select p_company, a.number, a.name, a.type, a.trust, a.section, a.tax_line, a.sys
  from (values
    -- Assets
    ('1000', 'Operating cash', 'asset', false, 'Cash', null, true),
    ('1010', 'Security deposit trust cash', 'asset', true, 'Cash', null, true),
    ('1020', 'Reserve cash', 'asset', false, 'Cash', null, false),
    ('1030', 'Petty cash', 'asset', false, 'Cash', null, false),
    ('1100', 'Accounts receivable: tenants', 'asset', false, 'Receivables and other assets', null, true),
    ('1150', 'Fees receivable from owners', 'asset', false, 'Receivables and other assets', null, true),
    ('1200', 'Undeposited funds', 'asset', false, 'Cash', null, true),
    ('1300', 'Prepaid expenses', 'asset', false, 'Receivables and other assets', null, false),
    ('1350', 'Tax and insurance escrow', 'asset', false, 'Receivables and other assets', null, false),
    ('1400', 'Utility deposits', 'asset', false, 'Receivables and other assets', null, false),
    ('1500', 'Land', 'asset', false, 'Capital improvements', null, false),
    ('1510', 'Buildings', 'asset', false, 'Capital improvements', null, false),
    ('1520', 'Building improvements', 'asset', false, 'Capital improvements', null, false),
    ('1530', 'Appliances', 'asset', false, 'Capital improvements', null, false),
    ('1540', 'Furniture, fixtures and equipment', 'asset', false, 'Capital improvements', null, false),
    ('1590', 'Accumulated depreciation', 'asset', false, 'Receivables and other assets', null, false),
    ('1600', 'Loan costs', 'asset', false, 'Receivables and other assets', null, false),
    ('1690', 'Accumulated amortization', 'asset', false, 'Receivables and other assets', null, false),
    -- Liabilities
    ('2000', 'Accounts payable', 'liability', false, 'Liabilities', null, true),
    ('2050', 'Due to management company', 'liability', false, 'Liabilities', null, true),
    ('2100', 'Security deposits held', 'liability', true, 'Liabilities', null, true),
    ('2110', 'Pet deposits held', 'liability', true, 'Liabilities', null, false),
    ('2200', 'Prepaid rent', 'liability', false, 'Liabilities', null, true),
    ('2300', 'Accrued expenses', 'liability', false, 'Liabilities', null, false),
    ('2310', 'Property taxes payable', 'liability', false, 'Liabilities', null, false),
    ('2400', 'Credit cards payable', 'liability', false, 'Liabilities', null, false),
    ('2500', 'Loans payable', 'liability', false, 'Liabilities', null, true),
    ('2510', 'Line of credit', 'liability', false, 'Liabilities', null, false),
    ('2600', 'Loans from owners', 'liability', false, 'Liabilities', null, false),
    -- Equity
    ('3000', 'Owner contributions', 'equity', false, 'Equity', null, true),
    ('3100', 'Owner distributions and draws', 'equity', false, 'Equity', null, true),
    ('3200', 'Retained earnings', 'equity', false, 'Equity', null, false),
    ('3900', 'Opening balance equity', 'equity', false, 'Equity', null, true),
    -- Income
    ('4000', 'Rent income', 'income', false, 'Rental income', 'Line 3 Rents received', true),
    ('4005', 'Housing assistance rent', 'income', false, 'Rental income', 'Line 3 Rents received', false),
    ('4010', 'Late fee income', 'income', false, 'Other tenant income', 'Line 3 Rents received', true),
    ('4020', 'Pet rent and fees', 'income', false, 'Other tenant income', 'Line 3 Rents received', true),
    ('4030', 'Returned payment fees', 'income', false, 'Other tenant income', 'Line 3 Rents received', true),
    ('4040', 'Utility reimbursements', 'income', false, 'Other tenant income', 'Line 3 Rents received', true),
    ('4050', 'CAM income', 'income', false, 'Other tenant income', 'Line 3 Rents received', true),
    ('4060', 'Damage and move-out charges', 'income', false, 'Other tenant income', 'Line 3 Rents received', true),
    ('4065', 'Lease break fees', 'income', false, 'Other tenant income', 'Line 3 Rents received', false),
    ('4070', 'Application fees', 'income', false, 'Other tenant income', 'Line 3 Rents received', false),
    ('4075', 'Parking and storage', 'income', false, 'Other tenant income', 'Line 3 Rents received', false),
    ('4080', 'Laundry and vending', 'income', false, 'Other tenant income', 'Line 3 Rents received', false),
    ('4085', 'Rent concessions', 'income', false, 'Rental income', 'Line 3 Rents received', false),
    ('4090', 'Other income', 'income', false, 'Other tenant income', 'Line 3 Rents received', true),
    ('4092', 'Insurance claim proceeds', 'income', false, 'Other income', null, false),
    ('4095', 'Interest income', 'income', false, 'Other income', null, false),
    ('4100', 'Management fee income', 'income', false, 'Management company income', null, true),
    ('4110', 'Leasing fee income', 'income', false, 'Management company income', null, true),
    ('4120', 'Renewal fee income', 'income', false, 'Management company income', null, true),
    ('4130', 'Maintenance markup income', 'income', false, 'Management company income', null, false),
    ('4140', 'Inspection and admin fee income', 'income', false, 'Management company income', null, false),
    -- Expenses
    ('5000', 'Repairs and maintenance', 'expense', false, 'Repairs and maintenance', 'Line 14 Repairs', true),
    ('5010', 'Plumbing', 'expense', false, 'Repairs and maintenance', 'Line 14 Repairs', false),
    ('5015', 'Electrical', 'expense', false, 'Repairs and maintenance', 'Line 14 Repairs', false),
    ('5020', 'Heating and air conditioning', 'expense', false, 'Repairs and maintenance', 'Line 14 Repairs', false),
    ('5025', 'Appliance repair', 'expense', false, 'Repairs and maintenance', 'Line 14 Repairs', false),
    ('5030', 'Roof repair', 'expense', false, 'Repairs and maintenance', 'Line 14 Repairs', false),
    ('5035', 'Painting', 'expense', false, 'Repairs and maintenance', 'Line 14 Repairs', false),
    ('5040', 'Flooring', 'expense', false, 'Repairs and maintenance', 'Line 14 Repairs', false),
    ('5045', 'Pest control', 'expense', false, 'Repairs and maintenance', 'Line 7 Cleaning and maintenance', false),
    ('5050', 'Lawn and landscaping', 'expense', false, 'Repairs and maintenance', 'Line 7 Cleaning and maintenance', false),
    ('5055', 'Pool maintenance', 'expense', false, 'Repairs and maintenance', 'Line 7 Cleaning and maintenance', false),
    ('5060', 'Cleaning and janitorial', 'expense', false, 'Repairs and maintenance', 'Line 7 Cleaning and maintenance', false),
    ('5065', 'Turnover and make-ready', 'expense', false, 'Repairs and maintenance', 'Line 14 Repairs', false),
    ('5070', 'Locks and keys', 'expense', false, 'Repairs and maintenance', 'Line 14 Repairs', false),
    ('5075', 'General handyman', 'expense', false, 'Repairs and maintenance', 'Line 14 Repairs', false),
    ('5080', 'Maintenance supplies', 'expense', false, 'Repairs and maintenance', 'Line 15 Supplies', false),
    ('5085', 'Security and alarm monitoring', 'expense', false, 'Repairs and maintenance', 'Line 19 Other', false),
    ('5100', 'Management fees', 'expense', false, 'Management and leasing', 'Line 11 Management fees', true),
    ('5110', 'Leasing and renewal fees', 'expense', false, 'Management and leasing', 'Line 8 Commissions', true),
    ('5120', 'Advertising and marketing', 'expense', false, 'Management and leasing', 'Line 5 Advertising', false),
    ('5130', 'Tenant screening', 'expense', false, 'Management and leasing', 'Line 19 Other', false),
    ('5140', 'Legal and eviction', 'expense', false, 'Administrative and professional', 'Line 10 Legal and other professional fees', false),
    ('5145', 'Accounting and tax preparation', 'expense', false, 'Administrative and professional', 'Line 10 Legal and other professional fees', false),
    ('5150', 'Bank fees', 'expense', false, 'Administrative and professional', 'Line 19 Other', false),
    ('5155', 'Payment processing fees', 'expense', false, 'Administrative and professional', 'Line 19 Other', false),
    ('5160', 'Office and postage', 'expense', false, 'Administrative and professional', 'Line 19 Other', false),
    ('5165', 'Software and subscriptions', 'expense', false, 'Administrative and professional', 'Line 19 Other', false),
    ('5170', 'Travel and mileage', 'expense', false, 'Administrative and professional', 'Line 6 Auto and travel', false),
    ('5180', 'Licenses and permits', 'expense', false, 'Administrative and professional', 'Line 16 Taxes', false),
    ('5190', 'HOA and condo dues', 'expense', false, 'Administrative and professional', 'Line 19 Other', false),
    ('5200', 'Utilities', 'expense', false, 'Utilities', 'Line 17 Utilities', false),
    ('5210', 'Electric', 'expense', false, 'Utilities', 'Line 17 Utilities', false),
    ('5220', 'Water and sewer', 'expense', false, 'Utilities', 'Line 17 Utilities', false),
    ('5230', 'Gas', 'expense', false, 'Utilities', 'Line 17 Utilities', false),
    ('5240', 'Trash and recycling', 'expense', false, 'Utilities', 'Line 17 Utilities', false),
    ('5250', 'Internet and cable', 'expense', false, 'Utilities', 'Line 17 Utilities', false),
    ('5300', 'Insurance', 'expense', false, 'Insurance and taxes', 'Line 9 Insurance', false),
    ('5310', 'Flood and windstorm insurance', 'expense', false, 'Insurance and taxes', 'Line 9 Insurance', false),
    ('5320', 'Liability insurance', 'expense', false, 'Insurance and taxes', 'Line 9 Insurance', false),
    ('5400', 'Property taxes', 'expense', false, 'Insurance and taxes', 'Line 16 Taxes', false),
    ('5410', 'Other taxes', 'expense', false, 'Insurance and taxes', 'Line 16 Taxes', false),
    ('5500', 'Mortgage interest', 'expense', false, 'Financing', 'Line 12 Mortgage interest paid to banks', true),
    ('5510', 'Other interest', 'expense', false, 'Financing', 'Line 13 Other interest', false),
    ('5520', 'Loan fees', 'expense', false, 'Financing', 'Line 19 Other', false),
    ('5600', 'Depreciation', 'expense', false, 'Depreciation', 'Line 18 Depreciation', false),
    ('5610', 'Amortization', 'expense', false, 'Depreciation', 'Line 19 Other', false),
    ('5700', 'Wages and salaries', 'expense', false, 'Payroll', 'Line 19 Other', false),
    ('5710', 'Payroll taxes', 'expense', false, 'Payroll', 'Line 16 Taxes', false),
    ('5720', 'Employee benefits', 'expense', false, 'Payroll', 'Line 19 Other', false),
    ('5800', 'Bad debt', 'expense', false, 'Other expenses', 'Line 19 Other', false),
    ('5900', 'Other expenses', 'expense', false, 'Other expenses', 'Line 19 Other', false)
  ) as a(number, name, type, trust, section, tax_line, sys)
  on conflict (company_id, number) do update
    set section = coalesce(public.gl_account.section, excluded.section),
        tax_line = coalesce(public.gl_account.tax_line, excluded.tax_line),
        system = public.gl_account.system or excluded.system;
end $$;
select public.ensure_chart_of_accounts(id) from public.company;
