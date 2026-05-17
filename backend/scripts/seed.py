"""
Run from backend/ directory:
    python -m scripts.seed

Creates:
  - 3 demo users  (employee / manager / admin)
  - 5 thrust areas
  - 2 cycles      (goal_setting active, q1 upcoming)
  - Default escalation rules
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from dotenv import load_dotenv
load_dotenv()

from app.core.database import SessionLocal, engine, Base
from app.core.security import hash_password
from app.models.user import User
from app.models.goal import ThrustArea, Cycle, CyclePhase
from app.models.escalation import EscalationRule
import app.models  # noqa — register all models
from datetime import date


def seed():
    Base.metadata.create_all(bind=engine)  # create tables if not exist
    db = SessionLocal()

    try:
        # ── Demo users ──────────────────────────────────────────────────────
        existing_emails = {u.email for u in db.query(User.email).all()}

        admin = None
        manager = None
        employee = None

        if "admin@demo.com" not in existing_emails:
            admin = User(
                name="Admin User",
                email="admin@demo.com",
                hashed_password=hash_password("Admin@123"),
                role="admin",
                department="HR",
            )
            db.add(admin)
            db.flush()
            print("  ✓ Admin created")
        else:
            admin = db.query(User).filter(User.email == "admin@demo.com").first()
            print("  – Admin already exists")

        if "manager@demo.com" not in existing_emails:
            manager = User(
                name="Manager User",
                email="manager@demo.com",
                hashed_password=hash_password("Manager@123"),
                role="manager",
                department="Sales",
                manager_id=admin.id,
            )
            db.add(manager)
            db.flush()
            print("  ✓ Manager created")
        else:
            manager = db.query(User).filter(User.email == "manager@demo.com").first()
            print("  – Manager already exists")

        if "employee@demo.com" not in existing_emails:
            employee = User(
                name="Employee User",
                email="employee@demo.com",
                hashed_password=hash_password("Employee@123"),
                role="employee",
                department="Sales",
                manager_id=manager.id,
            )
            db.add(employee)
            print("  ✓ Employee created")
        else:
            print("  – Employee already exists")

        # ── Thrust Areas ────────────────────────────────────────────────────
        thrust_areas = [
            ("Revenue Growth", "Goals related to sales targets and revenue generation"),
            ("Customer Satisfaction", "NPS, CSAT, and customer retention metrics"),
            ("Operational Excellence", "Process efficiency, TAT, and cost reduction"),
            ("People Development", "Training, mentoring, and team capability building"),
            ("Safety & Compliance", "Zero-incident targets and regulatory compliance"),
        ]
        existing_ta = {t.name for t in db.query(ThrustArea.name).all()}
        for name, desc in thrust_areas:
            if name not in existing_ta:
                db.add(ThrustArea(name=name, description=desc))
                print(f"  ✓ Thrust area: {name}")

        # ── Cycles ──────────────────────────────────────────────────────────
        db.query(Cycle).filter(Cycle.year == 2025).delete()
        existing_cycles = {(c.year, c.phase) for c in db.query(Cycle).all()}
        cycles = [
            (2026, CyclePhase.GOAL_SETTING, date(2026, 4, 1),  date(2026, 6, 30),  True),
            (2026, CyclePhase.Q1,           date(2026, 7, 1),  date(2026, 7, 31),  False),
            (2026, CyclePhase.Q2,           date(2026, 10, 1), date(2026, 10, 31), False),
            (2026, CyclePhase.Q3,           date(2027, 1, 1),  date(2027, 1, 31),  False),
            (2026, CyclePhase.Q4,           date(2027, 3, 1),  date(2027, 4, 30),  False),
        ]
        for year, phase, w_open, w_close, active in cycles:
            if (year, phase) not in existing_cycles:
                db.add(Cycle(year=year, phase=phase, window_open=w_open, window_close=w_close, is_active=active))
                print(f"  ✓ Cycle: {year} {phase.value}")
            else:
                print(f"  – Cycle already exists: {year} {phase.value}")

        # ── Escalation Rules ────────────────────────────────────────────────
        existing_rules = {r.trigger_type for r in db.query(EscalationRule.trigger_type).all()}
        rules = [
            ("employee_not_submitted",   7,  "employee,manager,hr", "Employee hasn't submitted goals within N days of cycle open"),
            ("manager_not_approved",     5,  "manager,hr",          "Manager hasn't approved within N days of submission"),
            ("checkin_not_completed",    7,  "employee,manager,hr", "Quarterly check-in not completed within active window"),
        ]
        for trigger, days, chain, desc in rules:
            if trigger not in existing_rules:
                db.add(EscalationRule(
                    trigger_type=trigger,
                    threshold_days=days,
                    notify_chain=chain,
                    description=desc,
                ))
                print(f"  ✓ Escalation rule: {trigger}")

        db.commit()
        print("\n✅ Seed complete.")
        print("\nDemo credentials:")
        print("  Employee → employee@demo.com / Employee@123")
        print("  Manager  → manager@demo.com  / Manager@123")
        print("  Admin    → admin@demo.com     / Admin@123")

    except Exception as e:
        db.rollback()
        print(f"\n❌ Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
