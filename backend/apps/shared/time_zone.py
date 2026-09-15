from datetime import datetime, timezone
from zoneinfo import ZoneInfo, available_timezones

_KNOWN_ZONES = available_timezones()


def is_time_zone(value):
    return isinstance(value, str) and value in _KNOWN_ZONES


def to_utc(value):
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)

    return value.astimezone(timezone.utc)


def now_in_zone(zone_name):
    return datetime.now(ZoneInfo(zone_name)) if is_time_zone(zone_name) else datetime.now(timezone.utc)


def parse_instant(value):
    if isinstance(value, datetime):
        return to_utc(value)

    if not isinstance(value, str) or not value:
        return None

    text = value.strip()

    if text.endswith("Z"):
        text = f"{text[:-1]}+00:00"

    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None

    return to_utc(parsed)
