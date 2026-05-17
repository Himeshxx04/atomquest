"""
Notifications via SendGrid (email) and MS Teams (adaptive cards) for all key BRD events:
  - Goal sheet submitted (to manager)
  - Goal sheet approved (to employee)
  - Goal sheet returned (to employee, with reason)
  - Check-in reminder (to employee)
  - Escalation notification (to employee / manager / HR chain)

Falls back silently if not configured — app never breaks.
"""
import urllib.request
import json as _json
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from ..core.config import settings
from ..models.user import User
from ..models.escalation import EscalationRule, EscalationEvent
from sqlalchemy.orm import Session


def _enabled() -> bool:
    return bool(settings.SENDGRID_API_KEY and not settings.SENDGRID_API_KEY.startswith("your-"))


def _teams_enabled() -> bool:
    return bool(settings.TEAMS_WEBHOOK_URL)


def _send_teams_card(title: str, message: str, deep_link_url: str, button_label: str, color: str = "accent"):
    """Post an Adaptive Card to the MS Teams incoming webhook."""
    if not _teams_enabled():
        print(f"[Teams] SKIP (webhook not configured) → {title}")
        return
    card = {
        "type": "message",
        "attachments": [{
            "contentType": "application/vnd.microsoft.card.adaptive",
            "contentUrl": None,
            "content": {
                "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                "type": "AdaptiveCard",
                "version": "1.4",
                "body": [
                    {
                        "type": "Container",
                        "style": "emphasis",
                        "items": [{
                            "type": "TextBlock",
                            "text": "⚡ AtomQuest — Goal Tracking Portal",
                            "weight": "Bolder",
                            "size": "Small",
                            "color": "Accent"
                        }]
                    },
                    {
                        "type": "TextBlock",
                        "text": title,
                        "weight": "Bolder",
                        "size": "Medium",
                        "wrap": True
                    },
                    {
                        "type": "TextBlock",
                        "text": message,
                        "wrap": True,
                        "spacing": "Small"
                    }
                ],
                "actions": [{
                    "type": "Action.OpenUrl",
                    "title": button_label,
                    "url": deep_link_url
                }]
            }
        }]
    }
    try:
        payload = _json.dumps(card).encode("utf-8")
        req = urllib.request.Request(
            settings.TEAMS_WEBHOOK_URL,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            print(f"[Teams] SENT → {title} (status {resp.status})")
    except Exception as e:
        print(f"[Teams] FAILED → {title} | {e}")


def _send(to_email: str, subject: str, html: str):
    if not _enabled():
        print(f"[Email] SKIP (SendGrid not configured) → {to_email} | {subject}")
        return

    try:
        message = Mail(
            from_email=settings.FROM_EMAIL,
            to_emails=to_email,
            subject=f"[AtomQuest] {subject}",
            html_content=html,
        )
        sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
        sg.send(message)
        print(f"[Email] SENT → {to_email} | {subject}")
    except Exception as e:
        print(f"[Email] FAILED → {to_email} | {subject} | {e}")


def _base_template(body: str) -> str:
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:8px">
      <div style="background:#1F3864;padding:16px;border-radius:6px 6px 0 0;margin-bottom:24px">
        <h2 style="color:#ffffff;margin:0;font-size:18px">AtomQuest — Goal Tracking Portal</h2>
      </div>
      {body}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
      <p style="color:#9ca3af;font-size:12px;margin:0">
        This is an automated notification. Please do not reply to this email.
      </p>
    </div>
    """


# ── Goal Sheet Events ─────────────────────────────────────────────────────────

def notify_sheet_submitted(employee: User, manager: User, cycle_label: str):
    html = _base_template(f"""
        <p style="color:#374151">Hi <strong>{manager.name}</strong>,</p>
        <p style="color:#374151">
          <strong>{employee.name}</strong> has submitted their goal sheet for <strong>{cycle_label}</strong>
          and is awaiting your approval.
        </p>
        <div style="background:#f3f4f6;padding:16px;border-radius:6px;margin:16px 0">
          <p style="margin:0;color:#374151"><strong>Employee:</strong> {employee.name}</p>
          <p style="margin:4px 0 0;color:#374151"><strong>Department:</strong> {employee.department or '—'}</p>
          <p style="margin:4px 0 0;color:#374151"><strong>Cycle:</strong> {cycle_label}</p>
        </div>
        <p style="color:#374151">Please log in to review and approve or return the goal sheet.</p>
        <a href="{settings.FRONTEND_URL}/manager/team"
           style="display:inline-block;background:#1F3864;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;margin-top:8px">
          Review Goals
        </a>
    """)
    _send(manager.email, f"{employee.name} submitted their goal sheet", html)
    _send_teams_card(
        title=f"📋 Goal Sheet Submitted — {employee.name}",
        message=f"{employee.name} ({employee.department or '—'}) has submitted their goal sheet for **{cycle_label}** and is awaiting your approval.",
        deep_link_url=f"{settings.FRONTEND_URL}/manager/approvals",
        button_label="Review & Approve"
    )


def notify_sheet_approved(employee: User, cycle_label: str):
    html = _base_template(f"""
        <p style="color:#374151">Hi <strong>{employee.name}</strong>,</p>
        <p style="color:#374151">
          Your goal sheet for <strong>{cycle_label}</strong> has been <strong style="color:#16a34a">approved</strong>.
          Your goals are now locked and active.
        </p>
        <p style="color:#374151">You can now log your quarterly achievements when the check-in window opens.</p>
        <a href="{settings.FRONTEND_URL}/employee/goals"
           style="display:inline-block;background:#16a34a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;margin-top:8px">
          View My Goals
        </a>
    """)
    _send(employee.email, "Your goal sheet has been approved", html)
    _send_teams_card(
        title=f"✅ Goal Sheet Approved — {cycle_label}",
        message=f"Your goal sheet for **{cycle_label}** has been approved. Your goals are now locked and active. You can start logging achievements when check-in windows open.",
        deep_link_url=f"{settings.FRONTEND_URL}/employee",
        button_label="View My Goals"
    )


def notify_sheet_returned(employee: User, reason: str, cycle_label: str):
    html = _base_template(f"""
        <p style="color:#374151">Hi <strong>{employee.name}</strong>,</p>
        <p style="color:#374151">
          Your goal sheet for <strong>{cycle_label}</strong> has been <strong style="color:#dc2626">returned</strong>
          for revision.
        </p>
        <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 16px;border-radius:4px;margin:16px 0">
          <p style="margin:0;color:#374151"><strong>Manager's feedback:</strong></p>
          <p style="margin:8px 0 0;color:#374151">{reason}</p>
        </div>
        <p style="color:#374151">Please update your goals and resubmit.</p>
        <a href="{settings.FRONTEND_URL}/employee/goals"
           style="display:inline-block;background:#dc2626;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;margin-top:8px">
          Revise Goals
        </a>
    """)
    _send(employee.email, "Your goal sheet needs revision", html)
    _send_teams_card(
        title=f"↩️ Goal Sheet Returned for Revision",
        message=f"Your goal sheet for **{cycle_label}** has been returned. Manager feedback: _{reason}_. Please revise and resubmit.",
        deep_link_url=f"{settings.FRONTEND_URL}/employee",
        button_label="Revise Goals"
    )


def notify_checkin_reminder(employee: User, quarter: str, days_remaining: int):
    html = _base_template(f"""
        <p style="color:#374151">Hi <strong>{employee.name}</strong>,</p>
        <p style="color:#374151">
          This is a reminder that the <strong>{quarter}</strong> check-in window closes in
          <strong>{days_remaining} day{"s" if days_remaining != 1 else ""}</strong>.
        </p>
        <p style="color:#374151">Please log your actual achievements before the window closes.</p>
        <a href="{settings.FRONTEND_URL}/employee/checkin"
           style="display:inline-block;background:#d97706;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;margin-top:8px">
          Log Achievements
        </a>
    """)
    _send(employee.email, f"{quarter} check-in reminder — {days_remaining} days left", html)


# ── Escalation Notifications ──────────────────────────────────────────────────

def send_escalation_notification(employee: User, rule: EscalationRule, event: EscalationEvent, db: Session):
    chain = [c.strip() for c in rule.notify_chain.split(",")]

    trigger_messages = {
        "employee_not_submitted": (
            "has not submitted their goal sheet",
            "You have not submitted your goal sheet yet. Please log in and submit as soon as possible."
        ),
        "manager_not_approved": (
            "has a pending goal sheet awaiting your approval",
            "You have a goal sheet pending your approval."
        ),
        "checkin_not_completed": (
            "has not completed their quarterly check-in",
            "You have not completed your quarterly check-in. Please log your achievements before the window closes."
        ),
    }

    action_phrase, employee_msg = trigger_messages.get(
        rule.trigger_type, ("has a pending action", "You have a pending action in AtomQuest.")
    )

    for target in chain:
        if target == "employee":
            html = _base_template(f"""
                <p style="color:#374151">Hi <strong>{employee.name}</strong>,</p>
                <p style="color:#dc2626;font-weight:bold">⚠ Action Required</p>
                <p style="color:#374151">{employee_msg}</p>
                <p style="color:#6b7280;font-size:13px">
                  This escalation was triggered because no action was taken within {rule.threshold_days} days.
                </p>
                <a href="{settings.FRONTEND_URL}/employee/goals"
                   style="display:inline-block;background:#1F3864;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;margin-top:8px">
                  Take Action Now
                </a>
            """)
            _send(employee.email, f"Action required: {rule.trigger_type.replace('_', ' ')}", html)

        elif target == "manager" and employee.manager:
            html = _base_template(f"""
                <p style="color:#374151">Hi <strong>{employee.manager.name}</strong>,</p>
                <p style="color:#dc2626;font-weight:bold">⚠ Escalation Alert</p>
                <p style="color:#374151">
                  Your team member <strong>{employee.name}</strong> {action_phrase}.
                  This is an automated escalation — please follow up.
                </p>
                <a href="{settings.FRONTEND_URL}/manager/team"
                   style="display:inline-block;background:#1F3864;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;margin-top:8px">
                  View Team
                </a>
            """)
            _send(employee.manager.email, f"Escalation: {employee.name} {action_phrase}", html)

        elif target == "hr":
            hr_users = db.query(User).filter(User.role == "admin", User.is_active == True).all()
            for hr in hr_users:
                html = _base_template(f"""
                    <p style="color:#374151">Hi <strong>{hr.name}</strong>,</p>
                    <p style="color:#dc2626;font-weight:bold">⚠ HR Escalation Alert — Level {event.escalation_level}</p>
                    <p style="color:#374151">
                      <strong>{employee.name}</strong> ({employee.department or 'No dept'}) {action_phrase}.
                      This has been escalated to HR for intervention.
                    </p>
                    <p style="color:#6b7280;font-size:13px">Note: {event.note or '—'}</p>
                    <a href="{settings.FRONTEND_URL}/admin/escalations"
                       style="display:inline-block;background:#1F3864;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;margin-top:8px">
                      View Escalations
                    </a>
                """)
                _send(hr.email, f"HR Escalation: {employee.name} — {rule.trigger_type}", html)
