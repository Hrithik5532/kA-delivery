"""Salary invoice schemas."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class SalaryInvoiceOut(BaseModel):
    id: int
    invoice_number: str
    rider_id: int
    rider_name: str
    rider_phone: str | None = None
    partner_code: str | None = None
    bank_name: str = ""
    bank_account_masked: str = ""
    ifsc_code: str = ""
    upi_id: str | None = None
    period: str
    period_label: str
    base_salary_cents: int
    additions_cents: int
    deductions_cents: int
    net_cents: int
    deliveries_count: int
    days_active: int
    status: str
    notes: str = ""
    payment_reference: str | None = None
    approved_by: str | None = None
    approved_at: datetime | None = None
    paid_at: datetime | None = None
    cancelled_reason: str | None = None
    created_at: datetime


class SalaryGenerateRequest(BaseModel):
    period: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    rider_id: int | None = None  # one partner only; omit for everyone


class SalarySkipped(BaseModel):
    rider_id: int
    name: str
    reason: str


class SalaryGenerateOut(BaseModel):
    created: list[SalaryInvoiceOut]
    skipped: list[SalarySkipped]


class SalaryInvoiceUpdate(BaseModel):
    base_salary_cents: int | None = Field(default=None, ge=0, le=100_000_000)
    additions_cents: int | None = Field(default=None, ge=0, le=100_000_000)
    deductions_cents: int | None = Field(default=None, ge=0, le=100_000_000)
    notes: str | None = Field(default=None, max_length=1000)
    refresh_activity: bool = False


class SalaryPaidRequest(BaseModel):
    payment_reference: str = Field(min_length=2, max_length=128)


class SalaryCancelRequest(BaseModel):
    reason: str = Field(min_length=2, max_length=500)


class SalaryListOut(BaseModel):
    period: str | None
    items: list[SalaryInvoiceOut]
    totals: dict[str, dict[str, int]] = {}


class RiderSalaryOut(BaseModel):
    monthly_salary_cents: int | None = None
    current_period: str
    current_period_label: str
    current_month_deliveries: int
    current_month_days_active: int
    total_paid_cents: int
    invoices: list[SalaryInvoiceOut]
