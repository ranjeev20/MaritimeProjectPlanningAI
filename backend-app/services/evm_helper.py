"""
EVM (Earned Value Management) Helper Service.
Contains utility classes to perform schedule and cost performance metrics calculations.
"""

class EVMCostHelper:
    """
    Helper class to handle cost-related EVM metrics:
    - Cost Variance (CV)
    - Cost Performance Index (CPI)
    """

    @staticmethod
    def calculate_cv(ev: float, ac: float) -> float:
        """
        Calculates Cost Variance (CV).
        Formula: CV = EV - AC
        - Positive value indicates under budget (good).
        - Negative value indicates over budget (bad).
        """
        return float(ev - ac)

    @staticmethod
    def calculate_cpi(ev: float, ac: float) -> float:
        """
        Calculates Cost Performance Index (CPI).
        Formula: CPI = EV / AC
        - CPI > 1.0 indicates cost efficiency (under budget).
        - CPI < 1.0 indicates cost inefficiency (over budget).
        
        Handles division-by-zero edge cases:
        - If AC is 0 and EV is 0, project hasn't incurred costs or earned value, returns 1.0.
        - If AC is 0 but EV > 0 (infinite efficiency), returns a capped value 99.9.
        """
        if ac == 0.0:
            return 1.0 if ev == 0.0 else 99.9
        
        return float(ev / ac)


class EVMTimeHelper:
    """
    Helper class to handle time/schedule-related EVM metrics:
    - Schedule Variance (SV)
    - Schedule Performance Index (SPI)
    """

    @staticmethod
    def calculate_sv(ev: float, pv: float) -> float:
        """
        Calculates Schedule Variance (SV).
        Formula: SV = EV - PV
        - Positive value indicates ahead of schedule (good).
        - Negative value indicates behind schedule (bad).
        """
        return float(ev - pv)

    @staticmethod
    def calculate_spi(ev: float, pv: float) -> float:
        """
        Calculates Schedule Performance Index (SPI).
        Formula: SPI = EV / PV
        - SPI > 1.0 indicates schedule efficiency (ahead of timeline).
        - SPI < 1.0 indicates schedule inefficiency (behind timeline).
        
        Handles division-by-zero edge cases:
        - If PV is 0 and EV is 0, project hasn't scheduled or performed work, returns 1.0.
        - If PV is 0 but EV > 0 (work performed before scheduled), returns a capped value 99.9.
        """
        if pv == 0.0:
            return 1.0 if ev == 0.0 else 99.9
        
        return float(ev / pv)
