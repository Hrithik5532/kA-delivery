/**
 * Typed API client for the delivery partner (rider) backend.
 */
import { config } from '@/config';
import type { DeliveryHistoryResponse, HistoryPeriod, HistoryStatus, 
  Batch,
  DeliveryCompletion,
  DeliveryHandover,
  DeliveryPhotoResult,
  VerifyOtpResult,
  WalletDetails,
  WalletTransactionsResponse,
  WalletTxnFilter,
  WalletWithdrawResult,
  PickupDetail,
  DeliveryIssue,
  CashoutResult,
  EarningsDetailResponse,
  EarningsResponse,
  OtpRequestResponse,
  Offer,
  OfferDetail,
  RiderDashboard,
  SupportHelp,
  SupportTicket,
  RiderDocument,
  Token,
  UserOut,
  VerificationStatus,
  RiderProfileDetail,
} from '@/api/types';

let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {}
): Promise<T> {
  const { method = 'GET', body, auth = true } = options;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth && authToken) headers.Authorization = `Bearer ${authToken}`;

  let resp: Response;
  try {
    resp = await fetch(`${config.apiUrl}/api/v1${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Network error — is the backend reachable?');
  }

  if (resp.status === 204) return undefined as T;

  const text = await resp.text();
  const data = text ? safeJson(text) : null;
  if (!resp.ok) {
    throw new ApiError(resp.status, extractDetail(data) ?? `Request failed (${resp.status})`);
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractDetail(data: unknown): string | null {
  if (data && typeof data === 'object' && 'detail' in data) {
    const detail = (data as { detail: unknown }).detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: string };
      return first?.msg ?? 'Validation error';
    }
  }
  return null;
}

export const api = {
  loginRider: (email: string, password: string) =>
    request<Token>('/auth/rider/login', { method: 'POST', body: { email, password }, auth: false }),
  requestRiderOtp: (phone: string) =>
    request<OtpRequestResponse>('/auth/rider/otp/request', { method: 'POST', body: { phone }, auth: false }),
  verifyRiderOtp: (phone: string, code: string) =>
    request<Token>('/auth/rider/otp/verify', { method: 'POST', body: { phone, code }, auth: false }),
  registerRider: (body: {
    email: string;
    password: string;
    full_name: string;
    phone?: string;
    emergency_contact?: string;
    vehicle_type: string;
    vehicle_number: string;
    license_number: string;
  }) => request<Token>('/auth/rider/register', { method: 'POST', body, auth: false }),
  me: () => request<UserOut>('/auth/me'),

  // Verification & documents
  verification: () => request<VerificationStatus>('/rider/verification'),
  riderProfile: () => request<RiderProfileDetail>('/rider/profile'),
  updateRiderProfile: (body: { app_language?: string }) =>
    request<RiderProfileDetail>('/rider/profile', { method: 'PATCH', body }),
  documents: () => request<RiderDocument[]>('/rider/documents'),
  resubmit: () => request<VerificationStatus>('/rider/resubmit', { method: 'POST' }),
  uploadDocument: async (
    docType: string,
    file: { uri: string; name: string; type: string }
  ): Promise<RiderDocument> => {
    // React Native multipart upload: FormData with the file descriptor object.
    const form = new FormData();
    form.append('doc_type', docType);
    // RN's fetch accepts { uri, name, type } as a file part.
    form.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
    const headers: Record<string, string> = {};
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    let resp: Response;
    try {
      resp = await fetch(`${config.apiUrl}/api/v1/rider/documents`, {
        method: 'POST',
        headers, // do NOT set Content-Type; RN sets the multipart boundary.
        body: form,
      });
    } catch {
      throw new ApiError(0, 'Network error — is the backend reachable?');
    }
    const text = await resp.text();
    const data = text ? safeJson(text) : null;
    if (!resp.ok) {
      throw new ApiError(resp.status, extractDetail(data) ?? `Upload failed (${resp.status})`);
    }
    return data as RiderDocument;
  },
  reportIssue: (deliveryId: number, issue_type: string, note: string) =>
    request<DeliveryIssue>(`/rider/deliveries/${deliveryId}/issues`, {
      method: 'POST',
      body: { issue_type, note },
    }),

  riderOnline: () => request<void>('/rider/online', { method: 'POST' }),
  riderOffline: () => request<void>('/rider/offline', { method: 'POST' }),
  riderOffers: () => request<Offer[]>('/rider/offers'),
  offerDetail: (offerId: number) => request<OfferDetail>(`/rider/offers/${offerId}`),
  riderActive: () => request<Batch | null>('/rider/active'),
  riderEarnings: () => request<EarningsResponse>('/rider/earnings'),
  riderEarningsDetail: (view: 'weekly' | 'daily' = 'weekly') =>
    request<EarningsDetailResponse>(`/rider/earnings/detail?view=${view}`),
  riderCashout: () => request<CashoutResult>('/rider/earnings/cashout', { method: 'POST' }),
  riderHistory: (status: HistoryStatus = 'completed', period: HistoryPeriod = 'this_week') =>
    request<DeliveryHistoryResponse>(`/rider/history?status=${status}&period=${period}`),
  riderDashboard: () => request<RiderDashboard>('/rider/dashboard'),
  supportHelp: () => request<SupportHelp>('/rider/support'),
  supportTickets: () => request<SupportTicket[]>('/rider/support/tickets'),
  submitSupportTicket: async (payload: {
    category: string;
    topic: string;
    message: string;
    order_id?: number;
    file?: { uri: string; name: string; type: string };
  }) => {
    const form = new FormData();
    form.append('category', payload.category);
    form.append('topic', payload.topic);
    form.append('message', payload.message);
    if (payload.order_id != null) form.append('order_id', String(payload.order_id));
    if (payload.file) {
      form.append('file', { uri: payload.file.uri, name: payload.file.name, type: payload.file.type } as unknown as Blob);
    }
    const headers: Record<string, string> = {};
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    let resp: Response;
    try {
      resp = await fetch(`${config.apiUrl}/api/v1/rider/support/tickets`, { method: 'POST', headers, body: form });
    } catch {
      throw new ApiError(0, 'Network error — is the backend reachable?');
    }
    const text = await resp.text();
    const data = text ? safeJson(text) : null;
    if (!resp.ok) throw new ApiError(resp.status, extractDetail(data) ?? `Request failed (${resp.status})`);
    return data as SupportTicket;
  },
  directions: (originLat: number, originLng: number, destLat: number, destLng: number) =>
    request<{
      points: Array<{ lat: number; lng: number }>;
      distance_meters: number | null;
      duration_seconds: number | null;
      source: string;
    }>(
      `/maps/directions?origin_lat=${originLat}&origin_lng=${originLng}&dest_lat=${destLat}&dest_lng=${destLng}&travel_mode=TWO_WHEELER`,
    ),
  postLocation: (body: {
    lat: number;
    lng: number;
    accuracy?: number;
    heading?: number;
    speed?: number;
    client_timestamp: string;
  }) =>
    request<{ accepted: boolean; server_timestamp: string; reason: string | null }>(
      '/rider/location',
      { method: 'POST', body }
    ),
  acceptOffer: (offerId: number) =>
    request<{ batch_id: number; status: string }>(`/deliveries/offers/${offerId}/accept`, { method: 'POST' }),
  rejectOffer: (offerId: number) =>
    request<{ rejected: boolean; reoffered: boolean }>(`/deliveries/offers/${offerId}/reject`, { method: 'POST' }),
  arrivedAtDrop: (deliveryId: number) => request<{ ok: boolean; arrived: boolean; arrived_at: string }>(`/deliveries/${deliveryId}/arrived`, { method: 'POST' }),
  pickupDetail: (deliveryId: number) => request<PickupDetail>(`/deliveries/${deliveryId}/pickup`),
  arrivedAtPickup: (deliveryId: number) =>
    request<{ ok: boolean; arrived: boolean; arrived_at: string }>(`/deliveries/${deliveryId}/pickup/arrived`, { method: 'POST' }),
  verifyPickupItems: (deliveryId: number, itemKeys: string[]) =>
    request<{ ok: boolean; verified_keys: string[] }>(`/deliveries/${deliveryId}/pickup/verify-items`, {
      method: 'POST',
      body: { item_keys: itemKeys },
    }),
  pickup: (deliveryId: number) =>
    request<{ batch_id: number; status: string }>(`/deliveries/${deliveryId}/pickup`, { method: 'POST' }),
  complete: (deliveryId: number, otp: string) =>
    request<DeliveryCompletion>(`/deliveries/${deliveryId}/complete`, {
      method: 'POST',
      body: { otp },
    }),
  deliveryHandover: (deliveryId: number) =>
    request<DeliveryHandover>(`/deliveries/${deliveryId}/handover`),
  verifyDeliveryOtp: (deliveryId: number, otp: string) =>
    request<VerifyOtpResult>(`/deliveries/${deliveryId}/verify-otp`, { method: 'POST', body: { otp } }),
  uploadDeliveryPhoto: async (deliveryId: number, file: { uri: string; name: string; type: string }) => {
    const form = new FormData();
    form.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
    const headers: Record<string, string> = {};
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    const resp = await fetch(`${config.apiUrl}/api/v1/deliveries/${deliveryId}/photo`, { method: 'POST', headers, body: form });
    const text = await resp.text();
    const data = text ? safeJson(text) : null;
    if (!resp.ok) throw new ApiError(resp.status, extractDetail(data) ?? `Upload failed (${resp.status})`);
    return data as DeliveryPhotoResult;
  },
  deliveryCompletion: (deliveryId: number) =>
    request<DeliveryCompletion>(`/deliveries/${deliveryId}/completion`),
  riderWallet: () => request<WalletDetails>('/rider/wallet'),
  riderWalletTransactions: (filter: WalletTxnFilter = 'all') =>
    request<WalletTransactionsResponse>(`/rider/wallet/transactions?filter=${filter}`),
  riderWalletWithdraw: (amount_cents: number, account_id = 'bank_primary') =>
    request<WalletWithdrawResult>('/rider/wallet/withdraw', { method: 'POST', body: { amount_cents, account_id } }),
};
