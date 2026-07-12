from datetime import datetime, date, timedelta
import re
import math

DATE_FORMAT = "%Y-%m-%d"

class WeekendHelper:
    """
    Helper class for weekend-aware date calculations and conversions between 
    working days, working weeks, and calendar dates.
    
    Conventions:
    - 1 Working Week = 5 Working Days (weekends excluded).
    - 8 Hours of effort = 1 Working Day.
    """

    @staticmethod
    def is_weekend(dt: date | datetime) -> bool:
        """Checks if a given date falls on a Saturday or Sunday."""
        return dt.weekday() >= 5

    @staticmethod
    def roll_to_next_work_day(dt: date | datetime) -> date | datetime:
        """Rolls a date forward to the next Monday if it falls on Saturday or Sunday."""
        current = dt
        while WeekendHelper.is_weekend(current):
            current += timedelta(days=1)
        return current

    @staticmethod
    def count_work_days(start_date: date | datetime, end_date: date | datetime) -> int:
        """Counts the number of work days (excluding weekends) between start_date and end_date (inclusive)."""
        if not start_date or not end_date:
            return 0
        if start_date > end_date:
            return 0
        
        curr = start_date
        work_days = 0
        while curr <= end_date:
            if not WeekendHelper.is_weekend(curr):
                work_days += 1
            curr += timedelta(days=1)
        return work_days

    @staticmethod
    def add_work_days(start_date: date | datetime, work_days: int) -> date | datetime:
        """Adds a number of work days to a start date, excluding weekends (Saturdays and Sundays)."""
        if work_days <= 0:
            return start_date

        current_date = WeekendHelper.roll_to_next_work_day(start_date)
        days_to_add = work_days - 1
        days_added = 0
        while days_added < days_to_add:
            current_date += timedelta(days=1)
            if not WeekendHelper.is_weekend(current_date):
                days_added += 1

        return current_date

    @staticmethod
    def working_days_to_weeks(work_days: int) -> int:
        """Converts working days to working weeks, rounding up (minimum 1 week)."""
        return max(1, math.ceil(work_days / 5.0))

    @staticmethod
    def weeks_to_working_days(weeks: int) -> int:
        """Converts working weeks to working days (5 working days per week)."""
        return (weeks or 0) * 5

    @staticmethod
    def parse_estimate_to_work_days(estimate: str) -> int:
        """
        Convert strings like '2d', '1w', '3h', '16h' into a number of work days.
        Conventions:
        - 8 hours = 1 work day.
        - 1 day = 1 work day.
        - 1 week = 5 work days.
        """
        if not estimate:
            return 0
        match = re.search(r"(\d+)\s*([dhw])", estimate.strip().lower())
        if not match:
            return 0
        value, unit = match.groups()
        value = int(value)
        if unit == "h":
            return max(1, math.ceil(value / 8.0))
        if unit == "d":
            return value
        if unit == "w":
            return WeekendHelper.weeks_to_working_days(value)
        return 0

    @staticmethod
    def add_dates(start: date | datetime, estimate: str) -> tuple[date | datetime, date | datetime]:
        """
        Return (planned_start, planned_end) based on start and estimate.
        Skips weekends (Saturday/Sunday) and bases durations on work days.
        """
        work_days = WeekendHelper.parse_estimate_to_work_days(estimate)
        start_rolled = WeekendHelper.roll_to_next_work_day(start)
        end = WeekendHelper.add_work_days(start_rolled, work_days)
        end_rolled = WeekendHelper.roll_to_next_work_day(end)
        return start_rolled, end_rolled

# --- Legacy Standalone Wrapper Functions for Backward Compatibility ---

def parse_estimate_to_work_days(estimate: str) -> int:
    return WeekendHelper.parse_estimate_to_work_days(estimate)

def add_work_days(start_date: datetime, work_days: int) -> datetime:
    return WeekendHelper.add_work_days(start_date, work_days)

def count_work_days(start_date: datetime, end_date: datetime) -> int:
    return WeekendHelper.count_work_days(start_date, end_date)

def roll_to_monday_if_weekend(dt: datetime) -> datetime:
    return WeekendHelper.roll_to_next_work_day(dt)

def add_dates(start: datetime, estimate: str) -> tuple[datetime, datetime]:
    return WeekendHelper.add_dates(start, estimate)
