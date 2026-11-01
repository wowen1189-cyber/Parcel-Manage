import { describe, expect, it } from "vitest";
import {
  address,
  bedsBaths,
  cents,
  guessTrade,
  isoDate,
  lateFeeTerms,
  parseCsv,
  personName,
  pets,
  phones,
  plates,
  readRentRoll,
  readTenantDirectory,
  readVendorDirectory,
  sameBusiness,
  samePerson,
  sortTenantTags,
} from "@/lib/import/appfolio";

describe("values", () => {
  it("reads money, dates and bed/bath counts", () => {
    expect(cents("1,380.50")).toBe(138050);
    expect(cents("-10.50")).toBe(-1050);
    expect(cents("")).toBeNull();
    expect(isoDate("05/01/2026")).toBe("2026-05-01");
    expect(isoDate("Month-To-Month")).toBeNull();
    expect(bedsBaths("2/1.00")).toEqual({ beds: 2, baths: 1 });
    expect(bedsBaths("--/--")).toEqual({ beds: null, baths: null });
  });

  it("splits names both ways", () => {
    expect(personName("Alex B. Example")).toEqual({ first_name: "Alex B.", last_name: "Example" });
    expect(personName("Casey  D. Example")).toEqual({ first_name: "Casey D.", last_name: "Example" });
    expect(personName("Doe, John")).toEqual({ first_name: "John", last_name: "Doe" });
    expect(personName("Javier")).toEqual({ first_name: "Javier", last_name: null });
  });

  it("splits addresses, including two-word cities", () => {
    expect(address("117 South 12th St. Leesburg, FL 34748")).toEqual({
      address_line1: "117 South 12th St.", address_line2: null, city: "Leesburg", state: "FL", postal_code: "34748",
    });
    expect(address("2025 Sunset Rd Mt Dora, FL 32757")).toMatchObject({ address_line1: "2025 Sunset Rd", city: "Mt Dora" });
    expect(address("PO Box 4648 Carol Stream, IL 60167")).toMatchObject({ address_line1: "PO Box 4648", city: "Carol Stream", state: "IL" });
    expect(address("PO Box 224528 Dallas, TX 75222-4528")).toMatchObject({ city: "Dallas", postal_code: "75222-4528" });
  });

  it("reads phone lists", () => {
    expect(phones("Office: (555) 010-0004, Fax: (555) 010-0005")).toEqual({ phone: "(555) 010-0004", mobile: null, extra: ["Fax (555) 010-0005"] });
    expect(phones("Mobile: (555) 010-0006, Mobile: (555) 010-0007")).toEqual({ phone: null, mobile: "(555) 010-0006", extra: ["Mobile (555) 010-0007"] });
  });
});

describe("tenant tags", () => {
  it("reads late fee terms written as dollars or percent", () => {
    expect(lateFeeTerms("Late after 3rd day | $75")).toEqual({ late_fee_grace_days: 3, late_fee_flat_cents: 7500, late_fee_pct: null });
    expect(lateFeeTerms("Late after 5th day | 10%")).toEqual({ late_fee_grace_days: 5, late_fee_flat_cents: null, late_fee_pct: 10 });
    expect(lateFeeTerms("Late after 10th day | 10% fee")).toMatchObject({ late_fee_grace_days: 10, late_fee_pct: 10 });
    expect(lateFeeTerms("Late after 10th day | $35")).toMatchObject({ late_fee_flat_cents: 3500 });
  });

  it("keeps door codes out of general notes and drops stale lease-end tags", () => {
    const t = sortTenantTags("Late after 3rd day | $75, Lease Expires 4/30/2027, 0000 Key Code, Resident Quarterly Inspection Photos, Parking Permit #0021");
    expect(t.lateFee?.late_fee_flat_cents).toBe(7500);
    expect(t.accessNotes).toEqual(["Key code 0000"]);
    expect(t.contactTags).toEqual(["Resident Quarterly Inspection Photos"]);
    expect(t.leaseNotes).toEqual(["Parking Permit #0021"]);
  });
});

describe("vendor trades", () => {
  it("guesses a trade from the vendor name", () => {
    expect(guessTrade("Dunstan Plumbing")).toBe("Plumbing");
    expect(guessTrade("Expert Appliance Repairs, Inc")).toBe("Appliance repair");
    expect(guessTrade("Duct-Man Mechanical Services")).toBe("HVAC");
    expect(guessTrade("Massey Services")).toBe("Pest control");
    expect(guessTrade("Duke Energy")).toBe("Utility");
    expect(guessTrade("Paid With Your Rent")).toBe("Other");
  });
});

const ROLL = [
  "Unit,BD/BA,Tenant,Status,Sqft,Market Rent,Rent,Deposit,Deposit Authorized,Lease From,Lease To,Move-in,Move-out,Past Due,NSF Count,Late Count,Property,Property Name,Property Address,Property Street Address 1,Property Street Address 2,Property Type,Amenities,Additional Tenants,Monthly Charges,Next Rent Increase Date,Next Rent Increase Amount,Tenant Tags,Lease Expires Month",
  "",
  '"-> 1 Example Lane Anytown, FL 32000","","","","","","","","","","","","","","","","","","","","","","","","","","","",""',
  ',3/2.50,Pat Sample,Current,"2,552","2,650.00","2,650.00","2,650.00",0.00,01/01/2026,12/31/2026,01/01/2026,,"2,250.00",0,1,"1 Example Lane Anytown, FL 32000",,"1 Example Lane Anytown, FL 32000",1 Example Lane,,Single-Family,,Sam Sample,,,,,Dec 2026',
  '"-> Example Plaza | Commercial",,,,,,,,,,,,,,,,,,,,,,,,,,,,',
  '10 Main St | Unit B,--/--,"Example Salon, LLC",Current,650,"1,100.00","1,000.00",800.00,0.00,02/01/2022,01/31/2023,02/01/2022,,"1,109.86",0,0,"Example Plaza","Example Plaza | Commercial","10 Main St Suites 127-135 Anytown, FL 32000",10 Main St,Suites 127-135,Commercial,,,109.86,,,"Late after 10th day | 10% fee, Lease Expires 01/31/2023",Month-To-Month',
  '208,1/1.00,,Vacant-Unrented,600,"1,199.00",,0.00,0.00,,,,,,,,"Example Plaza | Residential","Example Plaza | Residential","12 Main St Anytown, FL 32000",12 Main St,,Multi-Family,Coin Laundry,,0.00,,,,',
  '1 Units,,,100.0% Occupied,"2,552",,,,,,,,,,,,,,,,,,,,,,,,',
].join("\n");

describe("readRentRoll", () => {
  const props = readRentRoll(ROLL);

  it("groups units under properties and skips headers and subtotals", () => {
    expect(props.map((p) => [p.name, p.units.length])).toEqual([
      ["1 Example Lane", 1],
      ["Example Plaza | Commercial", 1],
      ["Example Plaza | Residential", 1],
    ]);
  });

  it("names a single-family unit Home and keeps co-tenants", () => {
    const home = props[0].units[0];
    expect(home.label).toBe("Home");
    expect(home.lease?.additionalTenants).toEqual(["Sam Sample"]);
    expect(home.lease?.past_due_cents).toBe(225000);
  });

  it("treats an expired commercial lease as month-to-month with its own late fee", () => {
    const lease = props[1].units[0].lease!;
    expect(lease.tenantIsBusiness).toBe(true);
    expect(lease.month_to_month).toBe(true);
    expect(lease.end_date).toBeNull();
    expect(lease.lateFee).toEqual({ late_fee_grace_days: 10, late_fee_flat_cents: null, late_fee_pct: 10 });
    expect(props[1].address.address_line2).toBe("Suites 127-135");
  });

  it("imports a vacant unit with no lease", () => {
    expect(props[2].units[0]).toMatchObject({ status: "vacant", lease: null, amenities: ["Coin Laundry"] });
  });
});

describe("readVendorDirectory", () => {
  it("reads people and companies", () => {
    const csv = [
      "Company Name,Name,Address,Phone Numbers,Email,Default GL Account,Payment Type,Send 1099?,Worker's Comp. Expiration,Liability Insurance Expiration,EPA Certification Expiration,Auto Insurance Expiration,State License Expiration,Contract Expiration,Tags,Vendor Portal Activated?,Last Payment Date",
      "",
      ',"Doe, Jane","432 N Anytown Stq Anytown, FL 32000",Mobile: (555) 010-0001,s@example.com,,eCheck,Yes,,,,,,,,Yes,10/05/2026',
      'Custom Electric,"Roe, Rick","10 Example Way Tavares, FL 32778","Office: (555) 010-0002, Mobile: (555) 010-0003",info@example.com,,CheckSend,Yes,,12/31/2026,,,,,,Yes,08/11/2026',
    ].join("\n");
    const [saida, custom] = readVendorDirectory(csv);
    expect(saida).toMatchObject({ kind: "person", first_name: "Jane", last_name: "Doe", payment_method: "ach", mobile: "(555) 010-0001" });
    expect(saida.address.address_line1).toBe("432 N Anytown St");
    expect(custom).toMatchObject({ kind: "business", business_name: "Custom Electric", contactPerson: "Rick Roe", trade: "Electrical", payment_method: "mailed_check", coi_expires_on: "2026-12-31", last_paid_on: "2026-08-11" });
  });

  it("parses quoted fields with commas and doubled quotes", () => {
    expect(parseCsv('a,"b, c","say ""hi"""\n')).toEqual([["a", "b, c", 'say "hi"']]);
  });
});

describe("tenant directory", () => {
  it("reads pets and plates", () => {
    expect(pets("Cat (Bear), Cat (Popcorn )")).toEqual([{ kind: "Cat", name: "Bear" }, { kind: "Cat", name: "Popcorn" }]);
    expect(pets("Mix Unknown  (Rex )")).toEqual([{ kind: "Mix Unknown", name: "Rex" }]);
    expect(pets("Pug")).toEqual([{ kind: "Pug", name: null }]);
    expect(plates("abc123, 12A BCD")).toEqual(["ABC123", "12ABCD"]);
  });

  it("matches people however their names were split, and businesses loosely", () => {
    expect(samePerson({ first_name: "Pat A.", last_name: "Sample" }, { first_name: "Pat", last_name: "Sample" })).toBe(true);
    expect(samePerson({ first_name: "Jo Ann", last_name: "Doe Smith" }, { first_name: "Jo", last_name: "Ann Doe Smith" })).toBe(true);
    expect(samePerson({ first_name: "Pat", last_name: "Sample" }, { first_name: "Sam", last_name: "Sample" })).toBe(false);
    expect(sameBusiness("The Example Bar, LLC - Boutique", "Example Bar LLC")).toBe(true);
    expect(sameBusiness("Example Bar", "Example Cafe")).toBe(false);
  });

  it("reads a row's contact details, role and the lease's late fee terms", () => {
    const csv = [
      "Property,Unit,Tenant,Status,Tenant Type,Phone Numbers,Emails,Lease From,Lease To,Tenant Tags,Property Name,Property Street Address 1,Certified Funds Only,Send Rent Reminders,Late Fee Type,Late Fee Base Amount,Late Fee Daily Amount,Grace Period,Max Daily Late Fees Amount,Liability to Landlord Insurance Coverage,Insurance Provider,Insurance Expiration,Insurance Policy Number,Primary Tenant,First Name,Last Name,Company Name,License Plates,Pets,NSF Fee Amount,Commercial Lease Type,Tenant Notes,Tenant Birthdate",
      '"Example Plaza - 10 Main St",204,"Sample, Pat",Current,Co-signer,"Mobile: (555) 010-0001, Phone: (555) 010-0002",pat@example.com,01/01/2026,12/31/2026,,Example Plaza,10 Main St,No,Yes,Flat Fee,75.00,10.00,3,250.00,Yes,Example Insurance,06/16/2027,P-1,No,Pat,Sample,,ABC123,Cat (Bear),50.00,,Quiet,01/01/1990',
      '"1 Example Lane",1 Example Lane,Example Shop LLC,Current,Financially Responsible,,shop@example.com,01/01/2026,12/31/2026,,,1 Example Lane,Yes,No,Percent of All Charges,10.00,0.00,5,,No,,,,Yes,Sam,Owner,Example Shop LLC,,,,Modified Gross,,',
    ].join("\n");
    const [pat, shop] = readTenantDirectory(csv);
    expect(pat).toMatchObject({
      role: "guarantor", isPrimary: false, kind: "person", first_name: "Pat", mobile: "(555) 010-0001", phone: "(555) 010-0002",
      email: "pat@example.com", plates: ["ABC123"], pets: [{ kind: "Cat", name: "Bear" }],
      insurance: { carrier: "Example Insurance", expires_on: "2027-06-16", companyIsInterestedParty: true },
      lease: { late_fee_grace_days: 3, late_fee_flat_cents: 7500, late_fee_daily_cents: 1000, late_fee_daily_max_cents: 25000, nsf_fee_cents: 5000, late_fee_basis: "rent" },
    });
    expect(pat).not.toHaveProperty("birthdate");
    // A unit named after the street is a single-family "Home"; a person row carries the business name too.
    expect(shop).toMatchObject({ unitLabel: "Home", kind: "person", company_name: "Example Shop LLC", lease: { late_fee_pct: 10, late_fee_basis: "all_charges", certified_funds_only: true, rent_reminders: false, commercial_lease_type: "Modified Gross" } });
  });
});
