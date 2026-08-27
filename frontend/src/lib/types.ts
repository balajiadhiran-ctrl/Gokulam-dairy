// Shared API types (mirror backend app/schemas.py).
export interface UserOut {
  id: number;
  email: string;
  full_name: string;
  owner_id: number | null;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  permissions: string[];
  user: UserOut;
}

export interface Owner {
  id: number;
  owner_code: string;
  name: string;
  name_hi: string | null;
  name_ta: string | null;
  mobile: string | null;
  email: string | null;
  village: string | null;
  status: string;
}

export interface BreedCount {
  breed: string;
  count: number;
}

export interface OwnerSummary extends Owner {
  cattle_count: number;
  cow_count: number;
  buffalo_count: number;
  breeds: BreedCount[];
}

export type AnimalType = "cow" | "buffalo";
export type CattleStatus = "active" | "dry" | "sold" | "deceased";

export interface Cattle {
  id: number;
  tag_number: string;
  name: string | null;
  animal_type: AnimalType;
  breed: string | null;
  gender: string;
  dob: string | null;
  owner_id: number;
  status: CattleStatus;
  photo_url: string | null;
}

export interface OwnerInput {
  owner_code?: string;
  name: string;
  name_hi?: string | null;
  name_ta?: string | null;
  mobile?: string | null;
  email?: string | null;
  village?: string | null;
  status?: string;
}

export interface CattleInput {
  tag_number?: string;
  name?: string | null;
  animal_type: AnimalType;
  breed?: string | null;
  gender?: string;
  dob?: string | null;
  owner_id: number;
  status?: CattleStatus;
}

export interface MilkOut {
  id: number;
  cattle_id: number;
  owner_id: number;
  prod_date: string;
  morning_litres: number;
  evening_litres: number;
  total_litres: number;
  recorded_by: number | null;
  created_at: string;
}

export interface MilkCreate {
  cattle_id: number;
  prod_date: string;
  morning_litres: number;
  evening_litres: number;
  client_uuid?: string;
}

export interface MilkBulkResult {
  created: MilkOut[];
  duplicates: string[];
  errors: string[];
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface MilkAnalyticsRow {
  key: string;
  total_litres: number;
  days: number;
}

// ---- Donations & donors -------------------------------------------------
export type DonationType =
  | "green_fodder"
  | "dry_grass"
  | "hay"
  | "feed"
  | "mineral"
  | "other";
export type DonationUnit = "kg" | "quintal" | "bag" | "bundle" | "piece";
export type DonationStatus = "new" | "acknowledged" | "received";

// Money arrives as a decimal string ("1500.00") — never a float — so rupee
// values survive the round trip without binary rounding error.
export type Money = string;

/** One row of the farm's feed catalogue: what it is and what it costs. */
export interface FeedItem {
  id: number;
  feed_code: string;
  name: string;
  name_hi: string | null;
  name_ta: string | null;
  category: DonationType;
  unit: DonationUnit;
  /** Rupees per `unit`, as a decimal string. */
  rate: Money;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

export interface FeedItemInput {
  name: string;
  name_hi?: string | null;
  name_ta?: string | null;
  category: DonationType;
  unit: DonationUnit;
  rate: string;
  notes?: string | null;
  is_active?: boolean;
}

export interface Donation {
  id: number;
  donor_id: number | null;
  feed_item_id: number | null;
  donor_name: string;
  phone: string | null;
  email: string | null;
  donation_type: DonationType;
  item: string | null;
  quantity: string | null;
  quantity_value: Money | null;
  unit: DonationUnit | null;
  unit_rate: Money | null;
  amount: Money | null;
  receipt_no: string | null;
  financial_year: string | null;
  public_token: string | null;
  message: string | null;
  status: DonationStatus;
  created_at: string;
}

export interface DonationInput {
  donor_name: string;
  /** Picked from the catalogue; supplies the category, unit and rate. */
  feed_item_id?: number | null;
  phone?: string | null;
  email?: string | null;
  donation_type: DonationType;
  item?: string | null;
  quantity_value?: number | null;
  unit?: DonationUnit | null;
  message?: string | null;
  /** Donor asked to be named on the public wall. Only ever opts in. */
  show_publicly?: boolean;
}

export interface DonationUpdate {
  status?: DonationStatus;
  feed_item_id?: number | null;
  item?: string | null;
  quantity_value?: number | null;
  unit?: DonationUnit | null;
  unit_rate?: number | null;
}

export interface ReceiptFarm {
  name: string;
  address: string;
  phone: string;
  email: string;
}

export interface Receipt {
  donation: Donation;
  donor_code: string | null;
  amount_in_words: string;
  farm: ReceiptFarm;
  /** False while the pledge is outstanding, true once staff log it as arrived. */
  confirmed: boolean;
}

export interface RateCard {
  rate_per_kg: Record<string, string>;
  unit_kg: Record<string, string | null>;
}

export interface Donor {
  id: number;
  donor_code: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  status: string;
  show_publicly: boolean;
  created_at: string;
}

export interface DonorSummary extends Donor {
  donation_count: number;
  total_amount: Money;
  received_amount: Money;
  last_donation_at: string | null;
}

export interface DonorDetail extends DonorSummary {
  donations: Donation[];
}

export interface DonorUpdate {
  name?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  status?: string;
  show_publicly?: boolean;
}

/** One gift as it appears publicly: what and when, never how much it was worth. */
export interface WallDonation {
  item: string | null;
  item_hi: string | null;
  item_ta: string | null;
  donation_type: DonationType;
  quantity: string | null;
  donated_at: string;
}

/** One name on the public thank-you wall — no contact details, no amounts. */
export interface WallDonor {
  name: string;
  donation_count: number;
  donations: WallDonation[];
}

export interface DonorWall {
  /** Everyone on the register: a count names nobody, so it is the true total. */
  total_donors: number;
  total_donations: number;
  /** Only the donors who consented to being named. */
  listed: WallDonor[];
}

// ---- Cattle rent -------------------------------------------------------
export type RentStatus = "draft" | "sent" | "paid" | "void";

export interface RentInvoiceLine {
  id: number;
  cattle_id: number | null;
  tag_number: string;
  name: string | null;
  animal_type: AnimalType;
  from_date: string;
  to_date: string;
  days: number;
  amount: Money;
  /** "joined 12 Aug" / "sold 3 Aug" — why a line is a part month. */
  note: string | null;
}

export interface RentInvoice {
  id: number;
  invoice_no: string;
  financial_year: string;
  owner_id: number;
  period_start: string;
  period_end: string;
  issued_on: string;
  due_date: string;
  rate_per_day: Money;
  cattle_days: number;
  amount: Money;
  status: RentStatus;
  sent_at: string | null;
  paid_at: string | null;
  email_to: string | null;
  email_error: string | null;
  public_token: string;
  created_at: string;
}

export interface RentInvoiceDetail extends RentInvoice {
  owner_name: string;
  lines: RentInvoiceLine[];
  amount_in_words: string;
  farm: ReceiptFarm | null;
}

export interface RentPreviewLine {
  cattle_id: number;
  tag_number: string;
  name: string | null;
  animal_type: AnimalType;
  from_date: string;
  to_date: string;
  days: number;
  amount: Money;
  note: string | null;
}

export interface RentPreviewOwner {
  owner_id: number;
  owner_code: string;
  owner_name: string;
  email: string | null;
  cattle_days: number;
  amount: Money;
  already_invoiced: boolean;
  lines: RentPreviewLine[];
}

export interface RentPreview {
  period_start: string;
  period_end: string;
  rate_per_day: Money;
  owners: RentPreviewOwner[];
  total_amount: Money;
  total_cattle_days: number;
}

export interface RentRunResult {
  period_start: string;
  period_end: string;
  created: number;
  skipped_existing: number;
  emailed: number;
  email_failed: number;
  mail_configured: boolean;
  invoices: RentInvoice[];
}

export interface RentSettings {
  rate_per_cattle_per_day: Money;
  issue_day: number;
  due_days: number;
  auto_run: boolean;
  auto_send: boolean;
  mail_configured: boolean;
  billable_statuses: string[];
}
