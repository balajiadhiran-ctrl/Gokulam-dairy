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
