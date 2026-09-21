"""In-memory WebSocket pub/sub for per-order tracking.

Customer tracking sockets subscribe per order. REST endpoints (which run in a
threadpool, off the event loop) call :meth:`publish` to wake subscribers; that
is made thread-safe via ``loop.call_soon_threadsafe``. Each subscriber also
refreshes on a timer so status changes propagate even without a location push.
"""
from __future__ import annotations

import asyncio


class WSManager:
    def __init__(self) -> None:
        self._subs: dict[int, set[asyncio.Event]] = {}
        self._loop: asyncio.AbstractEventLoop | None = None

    def set_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        """Bind the running event loop (called at app startup)."""
        self._loop = loop

    def subscribe(self, order_id: int) -> asyncio.Event:
        """Register a subscriber for an order. Call from the event loop."""
        self._loop = asyncio.get_running_loop()
        event = asyncio.Event()
        self._subs.setdefault(order_id, set()).add(event)
        return event

    def unsubscribe(self, order_id: int, event: asyncio.Event) -> None:
        subs = self._subs.get(order_id)
        if subs:
            subs.discard(event)
            if not subs:
                self._subs.pop(order_id, None)

    def publish(self, order_id: int) -> None:
        """Wake all subscribers of an order. Safe to call from any thread."""
        loop = self._loop
        if loop is None or loop.is_closed():
            return
        try:
            loop.call_soon_threadsafe(self._wake, order_id)
        except RuntimeError:
            # Loop shut down between the check and the call; nothing to wake.
            pass

    def _wake(self, order_id: int) -> None:
        for event in self._subs.get(order_id, set()):
            event.set()

    def subscriber_count(self, order_id: int) -> int:
        return len(self._subs.get(order_id, set()))


manager = WSManager()
