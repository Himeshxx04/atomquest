"""
APScheduler setup — runs escalation checks every 6 hours.
Attached to FastAPI lifespan so it starts/stops with the server.
"""
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
import logging

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler(timezone="UTC")


def start_scheduler():
    from ..services.escalation_service import run_all_checks

    scheduler.add_job(
        run_all_checks,
        trigger=IntervalTrigger(hours=6),
        id="escalation_checks",
        name="Run all escalation checks",
        replace_existing=True,
        max_instances=1,       # never run two instances simultaneously
    )
    scheduler.start()
    logger.info("Scheduler started — escalation checks every 6 hours")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")
