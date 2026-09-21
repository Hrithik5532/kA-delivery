"""Schemas for partner verification, documents and reported issues."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ApprovalStatus, DeliveryIssueStatus, DocumentStatus


class RiderDocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    doc_type: str
    original_name: str
    content_type: str
    size_bytes: int
    status: DocumentStatus
    uploaded_at: datetime
    expires_at: datetime | None = None


class VerificationStatusOut(BaseModel):
    approval_status: ApprovalStatus
    correction_reason: str | None = None
    can_go_online: bool
    documents: list[RiderDocumentOut] = []
    submitted_at: datetime | None = None
    submitted_label: str = ""
    verified_pct: int = 0
    steps_completed: int = 0
    steps_total: int = 3
    documents_submitted: int = 0
    documents_expected: int = 4
    status_headline: str = "Verification Under Review"
    status_subtitle: str = ""


class ReportIssueRequest(BaseModel):
    issue_type: str = Field(min_length=1, max_length=48)
    note: str = Field(default="", max_length=2000)


class DeliveryIssueOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    delivery_id: int | None
    order_id: int | None
    rider_id: int
    issue_type: str
    note: str
    status: DeliveryIssueStatus
    admin_note: str | None = None
    created_at: datetime

class SupportTicketCreate(BaseModel):
    category: str = Field(min_length=1, max_length=48)
    topic: str = Field(min_length=1, max_length=64)
    message: str = Field(min_length=1, max_length=500)
    order_id: int | None = None


class RiderProfileDetailOut(BaseModel):
    id: int
    full_name: str
    email: str | None = None
    phone: str | None = None
    partner_code: str
    rating: float
    trip_count: int
    is_online: bool
    approval_status: ApprovalStatus
    phone_verified: bool
    operating_hub: str
    fleet_tier: str
    surge_priority_pct: int
    vehicle_type: str
    vehicle_type_label: str
    vehicle_model: str
    vehicle_number: str
    vehicle_fuel_type: str
    vehicle_cargo_type: str
    rc_status: str
    rc_status_label: str
    bank_name: str
    bank_account_masked: str
    bank_summary: str
    upi_linked: bool
    app_language: str
    documents_summary: str
    documents_verified_count: int
    documents_total_count: int
    documents_valid_until: str


class RiderProfileUpdate(BaseModel):
    app_language: str | None = Field(default=None, max_length=64)


class SupportTopicOut(BaseModel):
    key: str
    label: str


class SupportCategoryOut(BaseModel):
    key: str
    label: str
    icon: str
    topics: list[SupportTopicOut]


class SupportAgentDeskOut(BaseModel):
    is_live: bool
    agent_name: str
    avg_wait_minutes: int


class SupportFaqOut(BaseModel):
    id: int
    category: str
    question: str
    answer: str


class SupportTicketOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ticket_number: str
    category: str
    topic: str
    title: str
    message: str
    order_id: int | None = None
    status: str
    status_label: str = ""
    has_attachment: bool = False
    attachment_name: str | None = None
    subtitle: str = ""
    created_at: datetime


class SupportHelpOut(BaseModel):
    sos_hotline: str
    agent_desk: SupportAgentDeskOut
    categories: list[SupportCategoryOut]
    faqs: list[SupportFaqOut]
    ongoing_tickets: list[SupportTicketOut]
    active_ticket_count: int


class DeliveryHistoryItemOut(BaseModel):
    delivery_id: int
    order_id: int
    ticket_ref: str
    status: str
    status_label: str
    mess_name: str
    dropoff_area: str
    completed_at: datetime | None = None
    time_label: str
    distance_km: float | None = None
    amount_cents: int
    tip_cents: int
    surge_multiplier: float | None = None
    has_surge: bool = False


class DeliveryHistorySummaryOut(BaseModel):
    completed_count: int
    cancelled_count: int
    total_earned_cents: int


class DeliveryHistoryOut(BaseModel):
    period: str
    period_label: str
    status: str
    summary: DeliveryHistorySummaryOut
    items: list[DeliveryHistoryItemOut]


class WalletBankOut(BaseModel):
    bank_name: str
    account_masked: str
    verified: bool
    label: str


class WalletPayoutAccountOut(BaseModel):
    id: str
    type: str
    label: str
    account_masked: str
    holder_name: str
    verified: bool
    is_primary: bool
    eta_label: str
    icon: str


class ProcessingWithdrawalOut(BaseModel):
    amount_cents: int
    reference_number: str
    bank_label: str
    eta_label: str
    status: str


class WalletOut(BaseModel):
    total_balance_cents: int
    locked_balance_cents: int
    available_balance_cents: int
    instant_payout_active: bool
    updated_label: str
    bank: WalletBankOut
    processing_withdrawal: ProcessingWithdrawalOut | None = None
    quick_amounts_cents: list[int]
    cashout_fee_cents: int
    payout_accounts: list[WalletPayoutAccountOut]
    min_withdraw_cents: int


class WalletTransactionOut(BaseModel):
    id: int
    txn_type: str
    icon: str
    title: str
    subtitle: str
    amount_cents: int
    status: str
    status_label: str
    reference_number: str
    time_label: str
    order_id: int | None = None


class WalletTransactionsOut(BaseModel):
    filter: str
    count: int
    items: list[WalletTransactionOut]


class WalletWithdrawRequest(BaseModel):
    amount_cents: int = Field(gt=0)
    account_id: str = "bank_primary"


class WalletWithdrawOut(BaseModel):
    ok: bool
    amount_cents: int
    fee_cents: int
    reference_number: str
    message: str
    eta_label: str
