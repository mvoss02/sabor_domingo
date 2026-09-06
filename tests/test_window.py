from datetime import datetime
from zoneinfo import ZoneInfo

from api._lib.window import window_is_open

AMS = ZoneInfo("Europe/Amsterdam")


def s(**over):
    base = {"open_day": "Wednesday", "close_day": "Sunday",
            "cutoff_time": "22:00", "window_override": "auto"}
    base.update(over)
    return base


def test_open_midweek():
    # Thursday afternoon
    assert window_is_open(s(), datetime(2026, 9, 3, 15, 0, tzinfo=AMS)) is True


def test_closed_monday():
    assert window_is_open(s(), datetime(2026, 8, 31, 12, 0, tzinfo=AMS)) is False


def test_open_sunday_before_cutoff():
    assert window_is_open(s(), datetime(2026, 9, 6, 21, 59, tzinfo=AMS)) is True


def test_closed_sunday_at_cutoff():
    assert window_is_open(s(), datetime(2026, 9, 6, 22, 0, tzinfo=AMS)) is False


def test_open_on_open_day_morning():
    # Wednesday 00:01
    assert window_is_open(s(), datetime(2026, 9, 2, 0, 1, tzinfo=AMS)) is True


def test_override_forces_closed():
    assert window_is_open(s(window_override="closed"),
                          datetime(2026, 9, 3, 15, 0, tzinfo=AMS)) is False


def test_override_forces_open():
    assert window_is_open(s(window_override="open"),
                          datetime(2026, 8, 31, 12, 0, tzinfo=AMS)) is True


def test_wrapping_window_sat_to_tue():
    st = s(open_day="Saturday", close_day="Tuesday")
    assert window_is_open(st, datetime(2026, 9, 6, 12, 0, tzinfo=AMS)) is True   # Sunday
    assert window_is_open(st, datetime(2026, 9, 3, 12, 0, tzinfo=AMS)) is False  # Thursday


def test_cutoff_with_seconds_format():
    # Postgres time comes back as "22:00:00"
    assert window_is_open(s(cutoff_time="22:00:00"),
                          datetime(2026, 9, 6, 21, 30, tzinfo=AMS)) is True


# --- cook_date_for -----------------------------------------------------------
# Seed rhythm: orders Wed → Sun 22:00, cook Monday.

from datetime import date
from api._lib.window import cook_date_for


def cs(**over):
    return s(cook_day="Monday", **over)


def test_cook_date_midweek_order():
    # Thursday 3 Sep → closes Sun 6 Sep → cooked Mon 7 Sep
    assert cook_date_for(cs(), datetime(2026, 9, 3, 15, 0, tzinfo=AMS)) == date(2026, 9, 7)


def test_cook_date_sunday_before_cutoff():
    assert cook_date_for(cs(), datetime(2026, 9, 6, 21, 59, tzinfo=AMS)) == date(2026, 9, 7)


def test_cook_date_sunday_after_cutoff_rolls_a_week():
    # Only reachable with window_override=open; ingredients for Mon 7 are bought.
    assert cook_date_for(cs(), datetime(2026, 9, 6, 22, 0, tzinfo=AMS)) == date(2026, 9, 14)


def test_cook_date_on_cook_day_itself_rolls_a_week():
    # Monday 7 Sep 10:00 (force-open) → next close Sun 13 → cook Mon 14
    assert cook_date_for(cs(), datetime(2026, 9, 7, 10, 0, tzinfo=AMS)) == date(2026, 9, 14)


def test_cook_date_same_day_close_and_cook():
    # Close Monday 09:00, cook Monday afternoon: order Sunday → cooked next day.
    st = cs(close_day="Monday", cutoff_time="09:00")
    assert cook_date_for(st, datetime(2026, 9, 6, 12, 0, tzinfo=AMS)) == date(2026, 9, 7)
    # Order Monday 09:30, after cutoff → next Monday.
    assert cook_date_for(st, datetime(2026, 9, 7, 9, 30, tzinfo=AMS)) == date(2026, 9, 14)
