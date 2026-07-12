from datetime import datetime, date
from core.date_helper import count_work_days

class BudgetHelper:
    HOURLY_WAGE = 100.0
    WORK_HOURS_PER_DAY = 8.0
    DAILY_RATE_PER_CREW_MEMBER = HOURLY_WAGE * WORK_HOURS_PER_DAY  # 800.0

    @classmethod
    def calculate_budget(cls, start: datetime | date | str | None, end: datetime | date | str | None, crew_needed: int | None) -> float:
        """
        Calculate budget cost based on start date, end date, and crew_needed.
        Formula: work_days * crew_needed * DAILY_RATE_PER_CREW_MEMBER
        """
        if not start or not end or crew_needed is None or crew_needed <= 0:
            return 0.0
        
        # Parse start
        if isinstance(start, str):
            try:
                start_dt = datetime.strptime(start.split(" ")[0], "%Y-%m-%d")
            except ValueError:
                try:
                    start_dt = datetime.strptime(start.split(" ")[0], "%d-%m-%Y")
                except ValueError:
                    return 0.0
        elif isinstance(start, date) and not isinstance(start, datetime):
            start_dt = datetime.combine(start, datetime.min.time())
        else:
            start_dt = start

        # Parse end
        if isinstance(end, str):
            try:
                end_dt = datetime.strptime(end.split(" ")[0], "%Y-%m-%d")
            except ValueError:
                try:
                    end_dt = datetime.strptime(end.split(" ")[0], "%d-%m-%Y")
                except ValueError:
                    return 0.0
        elif isinstance(end, date) and not isinstance(end, datetime):
            end_dt = datetime.combine(end, datetime.min.time())
        else:
            end_dt = end

        work_days = count_work_days(start_dt, end_dt)
        return float(work_days * crew_needed * cls.DAILY_RATE_PER_CREW_MEMBER)
