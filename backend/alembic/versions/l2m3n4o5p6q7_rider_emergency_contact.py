"""rider emergency contact

Revision ID: l2m3n4o5p6q7
Revises: k1l2m3n4o5p6
Create Date: 2026-09-18
"""
from alembic import op
import sqlalchemy as sa

revision = 'l2m3n4o5p6q7'
down_revision = 'k1l2m3n4o5p6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('rider_profiles', schema=None) as batch_op:
        batch_op.add_column(sa.Column('emergency_contact', sa.String(length=32), nullable=False, server_default=''))


def downgrade() -> None:
    with op.batch_alter_table('rider_profiles', schema=None) as batch_op:
        batch_op.drop_column('emergency_contact')
