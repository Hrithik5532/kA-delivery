/** Types mirroring the backend admin API (see backend/app/schemas/admin.py). */

export type ApprovalStatus =
  | 'draft'
  | 'pending'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'needs_correction';

export interface Token {
  access_token: string;
  token_type: string;
  role: string;
  roles: string[];
}

export interface Me {
  id: number;
  email: string | null;
  full_name: string;
  phone: string | null;
  roles: string[];
  admin_role: string | null;
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface AuditEvent {
  id: number;
  event_type: string;
  from_state: string | null;
  to_state: string | null;
  actor_user_id: number | null;
  target_type: string | null;
  target_id: number | null;
  reason: string | null;
  detail: string | null;
  created_at: string;
}

export interface RiderDocument {
  id: number;
  doc_type: string;
  original_name: string;
  content_type: string;
  size_bytes: number;
  status: string;
  uploaded_at: string;
}

export interface PartnerApplication {
  rider_id: number;
  full_name: string;
  email: string | null;
  phone: string | null;
  vehicle_type: string;
  vehicle_number: string;
  license_number: string;
  approval_status: ApprovalStatus;
  correction_reason: string | null;
  document_count: number;
  is_online: boolean;
  created_at: string;
}

export interface PartnerApplicationDetail extends PartnerApplication {
  documents: RiderDocument[];
  history: AuditEvent[];
}

export interface DeliveryIssue {
  id: number;
  delivery_id: number | null;
  order_id: number | null;
  rider_id: number;
  issue_type: string;
  note: string;
  status: string;
  admin_note: string | null;
  created_at: string;
}

export interface OverviewMetrics {
  pending_applications: number;
  approved_partners: number;
  online_partners: number;
  active_deliveries: number;
  unassigned_orders: number;
  delayed_or_issue_deliveries: number;
  orders_today: number;
  gmv_today_cents: number;
  live_kitchen: number;
  live_picked_up: number;
  live_en_route: number;
  platform_revenue_cents: number;
}

export interface FleetLeader {
  rider_id: number;
  full_name: string;
  total_deliveries: number;
  is_online: boolean;
}

export interface Overview {
  metrics: OverviewMetrics;
  recent_applications: PartnerApplication[];
  recent_issues: DeliveryIssue[];
  fleet_leaders: FleetLeader[];
}

export interface PartnerListItem {
  rider_id: number;
  full_name: string;
  email: string | null;
  phone: string | null;
  approval_status: ApprovalStatus;
  is_online: boolean;
  account_active: boolean;
  suspended_reason: string | null;
  current_batch_id: number | null;
  total_deliveries: number;
  partner_code: string | null;
  rating: number;
  vehicle_type: string;
  vehicle_model: string;
  vehicle_number: string;
  operating_hub: string;
  wallet_balance_cents: number;
  week_earnings_cents: number;
  payout_pending: boolean;
  active_order_id: number | null;
}

export interface AdminDeliveryRow {
  delivery_id: number;
  order_id: number;
  status: string;
  order_status: string;
  is_test: boolean;
  earning_cents: number;
  delivered_at: string | null;
  created_at: string;
}

export interface PartnerWalletTxn {
  id: number;
  reference_number: string;
  txn_type: string;
  title: string;
  subtitle: string;
  amount_cents: number;
  status: string;
  created_at: string;
  balance_after_cents: number | null;
}

export interface PartnerActiveOrder {
  order_id: number;
  status: string;
  pickup_label: string;
  dropoff_text: string;
  total_cents: number;
  eta_minutes: number | null;
  progress_step: number;
}

export interface PartnerDeliveryRow extends AdminDeliveryRow {
  mess_name: string | null;
  dropoff_text: string;
  distance_km: number | null;
  total_cents: number;
}

export interface PartnerKycItem { label: string; status: string; ok: boolean }
export interface PartnerAdminNote { id: number; text: string; author_id: number | null; created_at: string }

export interface PartnerDetail extends PartnerListItem {
  license_number: string;
  correction_reason: string | null;
  fleet_tier: string;
  bank_name: string;
  bank_account_masked: string;
  upi_linked: boolean;
  phone_verified: boolean;
  rc_status: string;
  documents_valid_until: string;
  emergency_contact: string;
  contact_email: string | null;
  vehicle_fuel_type: string;
  shift_preference: string;
  max_active_orders: number;
  total_earned_cents: number;
  cancel_rate_pct: number;
  tenure_months: number;
  wallet_locked_cents: number;
  wallet_available_cents: number;
  wallet_total_cents: number;
  upi_id: string | null;
  ifsc_code: string;
  daily_cashout_limit_cents: number;
  documents: RiderDocument[];
  kyc_items: PartnerKycItem[];
  wallet_transactions: PartnerWalletTxn[];
  active_order: PartnerActiveOrder | null;
  delivery_history: PartnerDeliveryRow[];
  admin_notes: PartnerAdminNote[];
  recent_deliveries: AdminDeliveryRow[];
  open_issues: DeliveryIssue[];
  history: AuditEvent[];
}

export interface PartnerUpdatePayload {
  full_name?: string;
  phone?: string;
  email?: string;
  emergency_contact?: string;
  operating_hub?: string;
  fleet_tier?: string;
  bank_name?: string;
  bank_account_masked?: string;
  upi_linked?: boolean;
  ifsc_code?: string;
  upi_id?: string;
  vehicle_model?: string;
  vehicle_number?: string;
  license_number?: string;
  vehicle_type?: string;
}

export interface OrderSummary {
  order_id: number;
  is_test: boolean;
  status: string;
  mess_name: string | null;
  customer_name: string | null;
  rider_name: string | null;
  delivery_status: string | null;
  total_cents: number;
  created_at: string;
}

export interface OrderDetail extends OrderSummary {
  dropoff_text: string;
  timeline: AuditEvent[];
  issues: DeliveryIssue[];
}

export interface RiderMarker {
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  server_timestamp: string;
  is_stale: boolean;
  age_seconds: number;
}

export interface ActiveDelivery {
  order_id: number;
  delivery_id: number | null;
  is_test: boolean;
  order_status: string;
  delivery_status: string | null;
  rider_id: number | null;
  rider_name: string | null;
  pickup_lat: number;
  pickup_lng: number;
  pickup_label: string | null;
  dropoff_lat: number;
  dropoff_lng: number;
  dropoff_text: string;
  rider_marker: RiderMarker | null;
  eta_minutes: number | null;
  distance_km: number | null;
}

export interface TestDelivery {
  order_id: number;
  is_test: boolean;
  status: string;
  pickup_label: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_label: string;
  dropoff_lat: number;
  dropoff_lng: number;
  test_note: string | null;
  rider_id: number | null;
  rider_name: string | null;
  delivery_status: string | null;
  otp_code: string | null;
  created_at: string;
}


export interface WithdrawalRequest {
  id: number;
  reference_number: string;
  payout_cycle: string;
  created_at: string;
  rider_id: number;
  rider_name: string;
  partner_code: string | null;
  fleet_tier: string;
  rating: number;
  amount_cents: number;
  fee_cents: number;
  net_amount_cents: number;
  wallet_balance_cents: number;
  post_cashout_balance_cents: number;
  bank_name: string;
  bank_account_masked: string;
  ifsc_code: string;
  account_holder: string;
  bank_verified: boolean;
  risk_score: number;
  risk_label: string;
  risk_note: string;
  status: 'pending_review' | 'approved' | 'rejected';
  admin_note: string | null;
  requires_dual_signoff: boolean;
  auto_disburse_eligible: boolean;
  reviewed_at: string | null;
}

export interface WithdrawalSummary {
  pending_count: number;
  pending_amount_cents: number;
  approved_today_count: number;
  approved_today_amount_cents: number;
  rejected_count: number;
  rejected_amount_cents: number;
  escrow_reserve_cents: number;
  liquidity_ratio: number;
  gateway_status: string;
  imps_success_rate: number;
  imps_latency_seconds: number;
  daily_cap_used_pct: number;
  tds_ytd_cents: number;
  tds_today_cents: number;
  fraud_rules_triggered: number;
  total_count: number;
}

export interface WithdrawalDetail extends WithdrawalRequest {
  settlement_gateway: string;
  escrow_lock_state: string;
  disbursal_target_seconds: number;
  priority_queue: boolean;
  partner: {
    rider_id: number;
    full_name: string;
    partner_code: string | null;
    operating_hub: string;
    rating: number;
    total_deliveries: number;
    active_since: string | null;
    fleet_tier: string;
    phone: string | null;
    kyc_compliance_pct: number;
    kyc_items: { label: string; value: string; ok: boolean }[];
    documents: { doc_type: string; status: string; original_name: string }[];
  };
  wallet: {
    gross_total_cents: number;
    escrow_locked_cents: number;
    available_cashout_cents: number;
    post_withdrawal_cents: number;
    daily_limit_cents: number;
    daily_limit_remaining_cents: number;
    daily_utilization_pct: number;
  };
  bank: {
    bank_name: string;
    branch: string;
    account_masked: string;
    ifsc_code: string;
    account_holder: string;
    penny_drop_verified: boolean;
    name_match_pct: number;
  };
  earning_components: {
    reference: string;
    title: string;
    category: string;
    timestamp: string;
    status: string;
    amount_cents: number;
  }[];
  payout_history: {
    reference_number: string;
    created_at: string;
    amount_cents: number;
    mode: string;
    utr: string;
    status: string;
  }[];
  risk: { score: number; label: string; checks: { label: string; ok: boolean }[] };
  gateway: { status: string; imps_latency_seconds: number; daily_reserve_remaining_pct: number; tds_cents: number };
  reject_reasons: string[];
}
