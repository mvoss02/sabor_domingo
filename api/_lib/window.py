from datetime import datetime, time

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


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
