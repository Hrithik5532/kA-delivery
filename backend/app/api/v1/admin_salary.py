"""Admin: partner monthly salary invoices (operations tier for changes)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import require_admin_permission
from app.database import get_db
from app.models.enums import AdminRole
from app.models.user import User
from app.schemas.salary import (
    SalaryCancelRequest,
    SalaryGenerateOut,
    SalaryGenerateRequest,
    SalaryInvoiceOut,
    SalaryInvoiceUpdate,
    SalaryListOut,
    SalaryPaidRequest,
)
from app.services import salary_service as svc

router = APIRouter(prefix="/admin/salary", tags=["admin-salary"])

_ops = require_admin_permission(AdminRole.operations)
_any_admin = require_admin_permission(
    AdminRole.partner_verification, AdminRole.operations, AdminRole.support
)


def _out(db: Session, inv) -> SalaryInvoiceOut:
    return SalaryInvoiceOut(**svc.invoice_out(db, inv))


@router.get("/invoices", response_model=SalaryListOut)
def list_invoices(
    period: str | None = Query(default=None, description="YYYY-MM"),
    status: str | None = Query(default=None, pattern="^(draft|approved|paid|cancelled)$"),
    _: User = Depends(_any_admin),
    db: Session = Depends(get_db),
) -> SalaryListOut:
    items = svc.list_invoices(db, period, status)
    return SalaryListOut(
        period=period,
        items=[SalaryInvoiceOut(**i) for i in items],
        totals=svc.totals(db, period) if period else {},
    )


@router.post("/invoices/generate", response_model=SalaryGenerateOut, status_code=201)
def generate(
    data: SalaryGenerateRequest, admin: User = Depends(_ops), db: Session = Depends(get_db)
) -> SalaryGenerateOut:
    if data.rider_id is not None:
        inv = svc.create_invoice(db, data.rider_id, data.period, admin.id)
        result = {"created": [inv], "skipped": []}
    else:
        result = svc.generate_for_period(db, data.period, admin.id)
    db.commit()
    return SalaryGenerateOut(
        created=[_out(db, i) for i in result["created"]], skipped=result["skipped"]
    )


@router.get("/invoices/{invoice_id}", response_model=SalaryInvoiceOut)
def get_invoice(invoice_id: int, _: User = Depends(_any_admin), db: Session = Depends(get_db)):
    return _out(db, svc._get(db, invoice_id))


@router.patch("/invoices/{invoice_id}", response_model=SalaryInvoiceOut)
def update_invoice(
    invoice_id: int, data: SalaryInvoiceUpdate, admin: User = Depends(_ops), db: Session = Depends(get_db)
):
    inv = svc.update_draft(db, invoice_id, admin.id, data.model_dump(exclude_unset=True))
    db.commit()
    return _out(db, inv)


@router.post("/invoices/{invoice_id}/approve", response_model=SalaryInvoiceOut)
def approve(invoice_id: int, admin: User = Depends(_ops), db: Session = Depends(get_db)):
    inv = svc.approve(db, invoice_id, admin.id)
    db.commit()
    return _out(db, inv)


@router.post("/invoices/{invoice_id}/paid", response_model=SalaryInvoiceOut)
def mark_paid(
    invoice_id: int, data: SalaryPaidRequest, admin: User = Depends(_ops), db: Session = Depends(get_db)
):
    inv = svc.mark_paid(db, invoice_id, admin.id, data.payment_reference)
    db.commit()
    return _out(db, inv)


@router.post("/invoices/{invoice_id}/cancel", response_model=SalaryInvoiceOut)
def cancel(
    invoice_id: int, data: SalaryCancelRequest, admin: User = Depends(_ops), db: Session = Depends(get_db)
):
    inv = svc.cancel(db, invoice_id, admin.id, data.reason)
    db.commit()
    return _out(db, inv)


@router.delete("/invoices/{invoice_id}", status_code=204)
def delete(invoice_id: int, admin: User = Depends(_ops), db: Session = Depends(get_db)) -> None:
    svc.delete_cancelled(db, invoice_id, admin.id)
    db.commit()
