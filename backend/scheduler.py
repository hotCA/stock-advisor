import logging
from typing import Optional
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)
_scheduler: Optional[BackgroundScheduler] = None


def start_scheduler() -> None:
    global _scheduler

    from main import _refresh_all, _refresh_market_data  # late import to avoid circular

    _scheduler = BackgroundScheduler(timezone="America/New_York")

    # Full refresh (with AI signals + Claude report) at market open, midday, close
    for hour, minute in [(9, 35), (13, 0), (16, 5)]:
        _scheduler.add_job(
            _refresh_all,
            CronTrigger(
                day_of_week="mon-fri",
                hour=hour,
                minute=minute,
                timezone="America/New_York",
            ),
            id=f"refresh_{hour}_{minute}",
            replace_existing=True,
        )

    # Light price-only refresh every 60s. The function itself skips work outside
    # US market hours so we don't hammer yfinance overnight/weekends.
    _scheduler.add_job(
        _refresh_market_data,
        IntervalTrigger(seconds=60),
        id="market_data_refresh",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )

    _scheduler.start()
    logger.info(
        "Scheduler started — full refresh at 9:35/13:00/16:05 ET, "
        "light price refresh every 60s during market hours"
    )
