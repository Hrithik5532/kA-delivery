"""Partner help & support: FAQs, categories, tickets."""
from __future__ import annotations

import os
import uuid

from fastapi import HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.base import utcnow
from app.models.support_faq import SupportFaq
from app.models.support_ticket import SupportTicket
from app.models.user import User

SOS_HOTLINE = "+9118005550199"
AGENT_WAIT_MINUTES = 2

CATEGORIES = [
    {
        "key": "payout",
        "label": "Payout & Incentives",
        "icon": "wallet",
        "topics": [
            {"key": "incorrect_weekly_payout", "label": "Incorrect weekly payout calculation"},
            {"key": "surge_adjustment", "label": "Surge multiplier adjustment"},
            {"key": "incentive_dispute", "label": "Incentive bonus dispute"},
            {"key": "payout_delay", "label": "Delayed payout to bank account"},
        ],
    },
    {
        "key": "delivery",
        "label": "Order & Delivery Issue",
        "icon": "delivery",
        "topics": [
            {"key": "customer_unreachable", "label": "Customer not answering phone or door"},
            {"key": "restaurant_delay", "label": "Restaurant pickup delay"},
            {"key": "wrong_address", "label": "Wrong or unreachable address"},
            {"key": "navigation_issue", "label": "Live navigation breakdown"},
        ],
    },
]

TOPIC_LABELS = {t["key"]: t["label"] for c in CATEGORIES for t in c["topics"]}

STATUS_LABELS = {
    "open": "Open",
    "in_review": "In Review",
    "resolved": "Resolved",
    "closed": "Closed",
}


def _ticket_dir(rider_id: int) -> str:
    path = os.path.join(settings.upload_dir, "support", str(rider_id))
    os.makedirs(path, exist_ok=True)
    return path


def _generate_ticket_number(db: Session) -> str:
    last = db.execute(select(SupportTicket).order_by(SupportTicket.id.desc())).scalars().first()
    seq = (last.id if last else 8923) + 1
    return f"DM-{seq}"


def topic_label(topic: str) -> str:
    return TOPIC_LABELS.get(topic, topic.replace("_", " ").title())


def list_faqs(db: Session) -> list[SupportFaq]:
    return db.execute(
        select(SupportFaq)
        .where(SupportFaq.is_active.is_(True))
        .order_by(SupportFaq.sort_order, SupportFaq.id)
    ).scalars().all()


def build_help_page(db: Session, user: User) -> dict:
    faqs = list_faqs(db)
    tickets = db.execute(
        select(SupportTicket)
        .where(
            SupportTicket.rider_id == user.id,
            SupportTicket.status.in_(["open", "in_review"]),
        )
        .order_by(SupportTicket.id.desc())
        .limit(10)
    ).scalars().all()

    active_count = len(tickets)
    return {
        "sos_hotline": SOS_HOTLINE,
        "agent_desk": {
            "is_live": True,
            "agent_name": "Priya Sharma",
            "avg_wait_minutes": AGENT_WAIT_MINUTES,
        },
        "categories": CATEGORIES,
        "faqs": [
            {"id": f.id, "category": f.category, "question": f.question, "answer": f.answer}
            for f in faqs
        ],
        "ongoing_tickets": [_ticket_dict(t) for t in tickets],
        "active_ticket_count": active_count,
    }


def _ticket_dict(ticket: SupportTicket) -> dict:
    subtitle_parts = []
    if ticket.order_id:
        subtitle_parts.append(f"Order #{ticket.order_id}")
    created = ticket.created_at.strftime("%b %d, %Y") if ticket.created_at else ""
    if created:
        subtitle_parts.append(f"Opened {created}")
    return {
        "id": ticket.id,
        "ticket_number": ticket.ticket_number,
        "category": ticket.category,
        "topic": ticket.topic,
        "title": ticket.title or topic_label(ticket.topic),
        "message": ticket.message,
        "order_id": ticket.order_id,
        "status": ticket.status,
        "status_label": STATUS_LABELS.get(ticket.status, ticket.status),
        "has_attachment": bool(ticket.attachment_path),
        "attachment_name": ticket.attachment_name,
        "created_at": ticket.created_at,
        "subtitle": " • ".join(subtitle_parts) if subtitle_parts else "Support request",
    }


def save_attachment(rider_id: int, upload: UploadFile) -> tuple[str, str]:
    allowed = {"image/jpeg", "image/png", "image/webp", "application/pdf"}
    if upload.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Attachment must be JPG, PNG, WEBP or PDF")
    ext = ".jpg" if upload.content_type == "image/jpeg" else ".png" if upload.content_type == "image/png" else ".webp" if upload.content_type == "image/webp" else ".pdf"
    name = upload.filename or f"attachment{ext}"
    path = os.path.join(_ticket_dir(rider_id), f"{uuid.uuid4().hex}{ext}")
    data = upload.file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Attachment must be under 5 MB")
    with open(path, "wb") as f:
        f.write(data)
    return path, name


def create_ticket(
    db: Session,
    user: User,
    category: str,
    topic: str,
    message: str,
    order_id: int | None = None,
    upload: UploadFile | None = None,
) -> SupportTicket:
    category = category.strip().lower()
    topic = topic.strip().lower()
    message = message.strip()
    if len(message) > 500:
        raise HTTPException(status_code=400, detail="Message must be 500 characters or fewer")
    if not message:
        raise HTTPException(status_code=400, detail="Please describe your issue")

    attachment_path = None
    attachment_name = None
    if upload is not None and upload.filename:
        attachment_path, attachment_name = save_attachment(user.id, upload)

    ticket = SupportTicket(
        rider_id=user.id,
        category=category,
        topic=topic,
        title=topic_label(topic),
        message=message,
        order_id=order_id,
        attachment_path=attachment_path,
        attachment_name=attachment_name,
        status="open",
        ticket_number=_generate_ticket_number(db),
    )
    db.add(ticket)
    db.flush()
    if not ticket.ticket_number:
        ticket.ticket_number = f"DM-{ticket.id}"
    return ticket


def seed_faqs(db: Session) -> None:
    if db.execute(select(SupportFaq).limit(1)).scalar_one_or_none():
        return
    entries = [
        ("payout", "When are weekly earnings deposited to my bank account?", "Weekly payouts are processed every Monday and typically arrive within 1–2 business days to your linked bank account.", 1),
        ("delivery", "What should I do if the customer is not answering the phone or door?", "Call the customer twice through the app. Wait 5 minutes, then use Report an Issue on the active delivery screen to notify operations.", 2),
        ("payout", "How do surge multiplier bonuses get calculated?", "Surge bonuses apply to deliveries completed in high-demand zones during peak hours. The multiplier is shown on the offer card before you accept.", 3),
        ("account", "How can I update my vehicle registration or driving license?", "Go to Profile → Documents & Licenses and upload clear photos of your updated documents for verification.", 4),
    ]
    for cat, q, a, order in entries:
        db.add(SupportFaq(category=cat, question=q, answer=a, sort_order=order, is_active=True))
    db.flush()
