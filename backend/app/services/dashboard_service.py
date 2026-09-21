"""Rider home dashboard: hotspots and incentive quests."""
from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.delivery import Delivery, DeliveryBatch
from app.models.enums import BatchStatus, DeliveryStatus, OrderStatus
from app.models.mess import Mess
from app.models.order import Order
from app.services.earnings_service import summary_for_rider, _format_duration, _online_minutes
from app.services.eta_service import haversine_km


def _ago_label(dt: datetime | None) -> str:
    if dt is None:
        return ""
    mins = int((datetime.utcnow() - dt).total_seconds() // 60)
    if mins < 1:
        return "Just now"
    if mins < 60:
        return f"{mins} mins ago"
    hours = mins // 60
    return f"{hours}h ago"


def build_dashboard(db: Session, rider_id: int) -> dict:
    earnings = summary_for_rider(db, rider_id)
    detail = __import__('app.services.earnings_service', fromlist=['detail_for_rider']).detail_for_rider(db, rider_id, view='daily')
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start = today_start - timedelta(days=1)

    open_batches = db.execute(
        select(DeliveryBatch.mess_id, func.count(DeliveryBatch.id))
        .where(DeliveryBatch.status.in_([BatchStatus.open, BatchStatus.offered]))
        .group_by(DeliveryBatch.mess_id)
        .order_by(func.count(DeliveryBatch.id).desc())
        .limit(5)
    ).all()

    hotspots = []
    top_hotspot = None
    for mess_id, batch_count in open_batches:
        mess = db.get(Mess, mess_id)
        if mess is None:
            continue
        demand = "high" if batch_count >= 3 else "medium" if batch_count >= 2 else "normal"
        multiplier = 1.3 if batch_count >= 3 else 1.2 if batch_count >= 2 else 1.1
        hotspots.append({
            "mess_id": mess.id,
            "mess_name": mess.name,
            "lat": mess.lat,
            "lng": mess.lng,
            "demand_level": demand,
            "multiplier": multiplier,
            "open_batches": int(batch_count),
        })
        if top_hotspot is None and demand != "normal":
            top_hotspot = {
                "title": f"High demand in {mess.name}",
                "subtitle": "Head toward hotspot for guaranteed order requests under 3 mins.",
                "multiplier": multiplier,
                "distance_km": 1.8,
                "lat": mess.lat,
                "lng": mess.lng,
                "map_label": "1.8 km to hotspot center",
            }

    today_deliveries = earnings.summary.today_deliveries
    target = 8
    bonus_cents = 25000
    completed = min(int(today_deliveries), target)
    remaining = max(0, target - completed)
    progress_pct = int((completed / target) * 100) if target else 0
    ends_at = today_start + timedelta(hours=23, minutes=0)
    ends_delta = ends_at - datetime.utcnow()
    ends_h = int(ends_delta.total_seconds() // 3600)
    ends_m = int((ends_delta.total_seconds() % 3600) // 60)
    ends_label = f"Ends in {ends_h}h {ends_m}m" if ends_h > 0 else f"Ends in {ends_m}m"

    quest = {
        "title": "Peak Dinner Bonus",
        "bonus_cents": bonus_cents,
        "progress_pct": progress_pct,
        "completed_deliveries": completed,
        "target_deliveries": target,
        "remaining": remaining,
        "ends_label": ends_label,
    }

    incentive_quest = {
        "title": f"Complete {target} deliveries for +₹{bonus_cents // 100}",
        "target_deliveries": target,
        "completed_deliveries": completed,
        "bonus_cents": bonus_cents,
        "ends_at": ends_at.isoformat(),
    }

    last_completed = None
    last_row = db.execute(
        select(Delivery, Order, Mess)
        .join(Order, Delivery.order_id == Order.id)
        .join(Mess, Order.mess_id == Mess.id)
        .where(
            Delivery.rider_id == rider_id,
            Delivery.status == DeliveryStatus.delivered,
        )
        .order_by(Delivery.delivered_at.desc())
        .limit(1)
    ).first()
    if last_row:
        delivery, order, mess = last_row
        item_count = sum(i.quantity for i in order.items) or 1
        last_completed = {
            "mess_name": mess.name,
            "ticket_ref": f"DM-{8800 + order.id}",
            "item_count": item_count,
            "amount_cents": delivery.earning_cents + delivery.tip_cents,
            "completed_at": delivery.delivered_at.isoformat() if delivery.delivered_at else "",
            "completed_ago_label": _ago_label(delivery.delivered_at),
        }

    pct = detail.get("weekly", {}).get("pct_change", 0.0) if isinstance(detail, dict) else getattr(detail.weekly, 'pct_change', 0.0)
    online_label = detail.get("daily", {}).get("online_label", "—") if isinstance(detail, dict) else getattr(detail.daily, 'online_label', "—")
    tips = 0
    for line in earnings.lines:
        tips += max(0, int(line.amount_cents * 0.12))

    return {
        "hotspots": hotspots,
        "incentive_quest": incentive_quest,
        "quest": quest,
        "today_deliveries": today_deliveries,
        "today_earnings_cents": earnings.summary.today_earned_cents,
        "earnings_pct_vs_yesterday": float(pct),
        "online_hours_label": online_label,
        "tips_cents": tips or int(earnings.summary.total_earned_cents * 0.12) if earnings.summary.total_earned_cents else 0,
        "last_completed": last_completed,
        "surge_hotspot": top_hotspot,
    }
