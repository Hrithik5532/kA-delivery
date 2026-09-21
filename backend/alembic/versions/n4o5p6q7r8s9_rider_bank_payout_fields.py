"""rider bank payout fields

Revision ID: n4o5p6q7r8s9
Revises: m3n4o5p6q7r8
"""
from alembic import op
import sqlalchemy as sa

revision = 'n4o5p6q7r8s9'
down_revision = 'm3n4o5p6q7r8'


def upgrade():
    with op.batch_alter_table('rider_profiles') as batch_op:
        batch_op.add_column(sa.Column('ifsc_code', sa.String(length=16), nullable=False, server_default=''))
        batch_op.add_column(sa.Column('upi_id', sa.String(length=128), nullable=True))


def downgrade():
    with op.batch_alter_table('rider_profiles') as batch_op:
        batch_op.drop_column('upi_id')
        batch_op.drop_column('ifsc_code')
