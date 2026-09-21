"""Push notification interface with pluggable providers.

The interface is stable; the ``dev`` provider records notifications in memory
(and logs them) so the whole flow works without real Expo credentials. Swapping
``NOTIFICATION_PROVIDER=expo`` and supplying a token would send real pushes.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Protocol

from app.config import settings

logger = logging.getLogger("digimess.notifications")


@dataclass
class Notification:
    user_id: int
    title: str
    body: str
    data: dict = field(default_factory=dict)


class NotificationProvider(Protocol):
    def send(self, notification: Notification) -> None: ...


class DevNotificationProvider:
    """Records notifications in memory; useful for tests and local dev."""

    def __init__(self) -> None:
        self.sent: list[Notification] = []

    def send(self, notification: Notification) -> None:
        self.sent.append(notification)
        logger.info(
            "[notify user=%s] %s — %s",
            notification.user_id,
            notification.title,
            notification.body,
        )


class ExpoNotificationProvider:
    """Placeholder for real Expo push. Requires EXPO_ACCESS_TOKEN + device tokens.

    Left unimplemented on purpose: it raises if selected without wiring so we
    never silently pretend a push was delivered.
    """

    def send(self, notification: Notification) -> None:  # pragma: no cover
        raise NotImplementedError(
            "Expo push provider not configured. Set NOTIFICATION_PROVIDER=dev "
            "for local development."
        )


def _build_provider() -> NotificationProvider:
    if settings.notification_provider == "expo":
        return ExpoNotificationProvider()
    return DevNotificationProvider()


provider: NotificationProvider = _build_provider()


def notify(user_id: int, title: str, body: str, data: dict | None = None) -> None:
    provider.send(Notification(user_id=user_id, title=title, body=body, data=data or {}))
