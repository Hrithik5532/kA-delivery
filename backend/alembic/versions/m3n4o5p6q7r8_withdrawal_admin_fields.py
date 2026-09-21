"""withdrawal admin fields

Revision ID: m3n4o5p6q7r8
Revises: l2m3n4o5p6q7
"""
from alembic import op
import sqlalchemy as sa

revision = 'm3n4o5p6q7r8'
down_revision = 'l2m3n4o5p6q7'


def upgrade():
    with op.batch_alter_table('wallet_transactions') as batch_op:
        batch_op.add_column(sa.Column('admin_note', sa.String(length=500), nullable=True))
        batch_op.add_column(sa.Column('risk_score', sa.Integer(), nullable=False, server_default='95'))
        batch_op.add_column(sa.Column('risk_label', sa.String(length=64), nullable=False, server_default='Low Risk'))
        batch_op.add_column(sa.Column('payout_cycle', sa.String(length=32), nullable=True))
        batch_op.add_column(sa.Column('reviewed_by_user_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('reviewed_at', sa.DateTime(), nullable=True))


def downgrade():
    with op.batch_alter_table('wallet_transactions') as batch_op:
        batch_op.drop_column('reviewed_at')
        batch_op.drop_column('reviewed_by_user_id')
        batch_op.drop_column('payout_cycle')
        batch_op.drop_column('risk_label')
        batch_op.drop_column('risk_score')
        batch_op.drop_column('admin_note')
