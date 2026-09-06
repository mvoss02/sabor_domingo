from datetime import date, datetime, time, timedelta

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def cook_date_for(settings: dict, now: datetime) -> date:
    """The calendar date this order will be cooked on.

    An order belongs to the ordering window it was placed in; that window
    ends at close_day/cutoff_time, and the food is cooked on the first
    cook_day on or after that close. Deriving it from the *close* rather
    than from `now` directly matters when the window is force-open: an
    order placed Sunday 23:00 (after a 22:00 cutoff) must land in next
    week's cook, not tomorrow's, since tomorrow's ingredients are bought.

    `now` must be timezone-aware in Europe/Amsterdam (the caller's job).
    """
    close_i = DAYS.index(settings["close_day"])
    cook_i = DAYS.index(settings["cook_day"])
    today = now.date()

    close = today + timedelta(days=(close_i - today.weekday()) % 7)
    if close == today and now.time() >= _parse_cutoff(str(settings["cutoff_time"])):
        close += timedelta(days=7)

    return close + timedelta(days=(cook_i - close.weekday()) % 7)


def _parse_cutoff(raw: str) -> time:
    parts = [int(p) for p in raw.split(":")]
    return time(parts[0], parts[1])


def window_is_open(settings: dict, now: datetime) -> bool:
    override = settings.get("window_override", "auto")
    if override == "open":
        return True
    if override == "closed":
        return False

    open_i = DAYS.index(settings["open_day"])
    close_i = DAYS.index(settings["close_day"])
    today_i = now.weekday()

    if open_i <= close_i:
        in_days = open_i <= today_i <= close_i
    else:  # window wraps the week boundary
        in_days = today_i >= open_i or today_i <= close_i

    if not in_days:
        return False
    if today_i == close_i and now.time() >= _parse_cutoff(str(settings["cutoff_time"])):
        return False
    return True
