"""Add at_risk, behind, exceeded to goalstatus enum

Revision ID: 001
Revises:
Create Date: 2025-05-17
"""
from alembic import op

revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # PostgreSQL ALTER TYPE must run outside a transaction for ADD VALUE
    op.execute("ALTER TYPE goalstatus ADD VALUE IF NOT EXISTS 'at_risk'")
    op.execute("ALTER TYPE goalstatus ADD VALUE IF NOT EXISTS 'behind'")
    op.execute("ALTER TYPE goalstatus ADD VALUE IF NOT EXISTS 'exceeded'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values; downgrade is a no-op
    pass
