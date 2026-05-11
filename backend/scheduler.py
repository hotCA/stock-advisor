import logging
from typing import Optional
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)
_scheduler: Optional[BackgroundScheduler] = None


def start_scheduler() -> None:
    global _scheduler

    from main import _refresh_all  # imported late to avoid circular import

    _scheduler = BackgroundScheduler(timezone="America/New_York")

    # Refresh at market open (9:35 AM ET), midday (1:00 PM), and close (4:05 PM)
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

    _scheduler.start()
    logger.info("Scheduler started — refreshes at 9:35, 13:00, 16:05 ET (Mon-Fri)")
