/**
 * Typed API client for the delivery partner (rider) backend.
 */
import { File as FsFile, UploadType } from 'expo-file-system';
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

type UploadOpts = { mimeType: string; fieldName?: string; parameters?: Record<string, string> };

/**
 * Whether the native `expo-file-system` File-upload API is usable at runtime.
 * In a dev/prod build it is compiled in and works. In Expo Go the bundled
 * filesystem module is older and the `File` constructor throws
 * ("this.validatePath is not a function"), so we probe once and fall back to
 * a pure-RN fetch upload there.
 */
let nativeFileUpload: boolean | null = null;
function hasNativeFileUpload(): boolean {
  if (nativeFileUpload !== null) return nativeFileUpload;
  try {
    new FsFile('file:///probe.jpg'); // ctor calls the native validatePath()
    nativeFileUpload = true;
  } catch {
    nativeFileUpload = false;
  }
  return nativeFileUpload;
}

function fileNameFromUri(uri: string, mimeType: string): string {
  const seg = (uri.split('/').pop() ?? '').split('?')[0];
  if (seg.includes('.')) return seg;
  return `upload.${mimeType.split('/')[1] || 'jpg'}`;
}

/** Native multipart upload — correct serialization, progress, large files. */
async function uploadViaNativeFile<T>(path: string, fileUri: string, opts: UploadOpts): Promise<T> {
  const headers: Record<string, string> = {};
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const resp = await new FsFile(fileUri).upload(`${config.apiUrl}/api/v1${path}`, {
    httpMethod: 'POST',
    uploadType: UploadType.MULTIPART,
    fieldName: opts.fieldName ?? 'file',
    mimeType: opts.mimeType,
    parameters: opts.parameters,
    headers,
  });
  const data = resp.body ? safeJson(resp.body) : null;
  if (resp.status < 200 || resp.status >= 300) {
    throw new ApiError(resp.status, extractDetail(data) ?? `Upload failed (${resp.status})`);
  }
  return data as T;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/**
 * Pure-RN fallback for Expo Go. RN's `FormData` mis-serializes `{uri}` file
 * parts on the New Architecture (backend sees `str` → "Expected UploadFile"),
 * and RN can't build a byte-backed Blob from JS. So we read the file's real
 * bytes and assemble the multipart body by hand. RN's networking base64-encodes
 * an `ArrayBuffer`/typed-array body and sends it raw, so the file part carries
 * actual bytes under the Content-Type/boundary we set.
 */
async function uploadViaFetch<T>(path: string, fileUri: string, opts: UploadOpts): Promise<T> {
  let fileBytes: Uint8Array;
  try {
    const ab = await (await fetch(fileUri)).arrayBuffer(); // RN serves file:// URIs
    fileBytes = new Uint8Array(ab);
  } catch {
    throw new ApiError(0, 'Could not read the selected image file');
  }
  if (fileBytes.length === 0) throw new ApiError(0, 'The selected image is empty');

  const boundary = `----khanaBoundary${Math.random().toString(16).slice(2)}${Date.now().toString(16)}`;
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  if (opts.parameters) {
    for (const [k, v] of Object.entries(opts.parameters)) {
      chunks.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
    }
  }
  const filename = fileNameFromUri(fileUri, opts.mimeType);
  chunks.push(
    enc.encode(
      `--${boundary}\r\nContent-Disposition: form-data; name="${opts.fieldName ?? 'file'}"; ` +
        `filename="${filename}"\r\nContent-Type: ${opts.mimeType}\r\n\r\n`,
    ),
  );
  chunks.push(fileBytes);
  chunks.push(enc.encode(`\r\n--${boundary}--\r\n`));
  const body = concatBytes(chunks);

  const headers: Record<string, string> = {
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  let resp: Response;
  try {
    resp = await fetch(`${config.apiUrl}/api/v1${path}`, {
      method: 'POST',
      headers,
      body: body as unknown as BodyInit,
    });
  } catch {
    throw new ApiError(0, 'Network error — is the backend reachable?');
  }
  const text = await resp.text();
  const data = text ? safeJson(text) : null;
  if (!resp.ok) throw new ApiError(resp.status, extractDetail(data) ?? `Upload failed (${resp.status})`);
  return data as T;
}

/**
 * Multipart file upload. Uses the native `File.upload()` API in dev/prod builds
 * and falls back to `fetch` + `FormData` in Expo Go (where the native API is
 * unavailable). Extra form fields go in `parameters`.
 */
async function uploadMultipart<T>(path: string, fileUri: string, opts: UploadOpts): Promise<T> {
  if (hasNativeFileUpload()) return uploadViaNativeFile<T>(path, fileUri, opts);
  return uploadViaFetch<T>(path, fileUri, opts);
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
  uploadDocument: (
    docType: string,
    file: { uri: string; name: string; type: string }
  ): Promise<RiderDocument> =>
    uploadMultipart<RiderDocument>('/rider/documents', file.uri, {
      mimeType: file.type,
      parameters: { doc_type: docType },
    }),
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
    const parameters: Record<string, string> = {
      category: payload.category,
      topic: payload.topic,
      message: payload.message,
    };
    if (payload.order_id != null) parameters.order_id = String(payload.order_id);

    // With an attachment: use the native multipart file upload (RN fetch/legacy
    // uploadAsync both fail in Expo Go SDK 57). Without one: a text-only
    // FormData part serializes fine over fetch.
    if (payload.file) {
      return uploadMultipart<SupportTicket>('/rider/support/tickets', payload.file.uri, {
        mimeType: payload.file.type,
        parameters,
      });
    }
    const form = new FormData();
    for (const [key, value] of Object.entries(parameters)) form.append(key, value);
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
  complete: (deliveryId: number) =>
    request<DeliveryCompletion>(`/deliveries/${deliveryId}/complete`, {
      method: 'POST',
      body: {},
    }),
  deliveryHandover: (deliveryId: number) =>
    request<DeliveryHandover>(`/deliveries/${deliveryId}/handover`),
  verifyDeliveryOtp: (deliveryId: number, otp: string) =>
    request<VerifyOtpResult>(`/deliveries/${deliveryId}/verify-otp`, { method: 'POST', body: { otp } }),
  uploadDeliveryPhoto: (deliveryId: number, file: { uri: string; name: string; type: string }) =>
    uploadMultipart<DeliveryPhotoResult>(`/deliveries/${deliveryId}/photo`, file.uri, {
      mimeType: file.type,
    }),
  deliveryCompletion: (deliveryId: number) =>
    request<DeliveryCompletion>(`/deliveries/${deliveryId}/completion`),
  riderWallet: () => request<WalletDetails>('/rider/wallet'),
  riderWalletTransactions: (filter: WalletTxnFilter = 'all') =>
    request<WalletTransactionsResponse>(`/rider/wallet/transactions?filter=${filter}`),
  riderWalletWithdraw: (amount_cents: number, account_id = 'bank_primary') =>
    request<WalletWithdrawResult>('/rider/wallet/withdraw', { method: 'POST', body: { amount_cents, account_id } }),
};
