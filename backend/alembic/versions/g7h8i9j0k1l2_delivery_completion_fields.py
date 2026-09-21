"""delivery completion payout breakdown
Revision ID: g7h8i9j0k1l2
Revises: f6a7b8c9d0e1
"""
from alembic import op
import sqlalchemy as sa
revision = 'g7h8i9j0k1l2'
down_revision = 'f6a7b8c9d0e1'

def upgrade():
    with op.batch_alter_table('deliveries', schema=None) as batch_op:
        batch_op.add_column(sa.Column('base_fare_cents', sa.Integer(), nullable=False, server_default='9000'))
        batch_op.add_column(sa.Column('distance_pay_cents', sa.Integer(), nullable=False, server_default='0'))
        batch_op.add_column(sa.Column('surge_bonus_cents', sa.Integer(), nullable=False, server_default='0'))
        batch_op.add_column(sa.Column('estimated_minutes', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('rider_rating', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('rating_comment', sa.String(length=128), nullable=True))

def downgrade():
    with op.batch_alter_table('deliveries', schema=None) as batch_op:
        batch_op.drop_column('rating_comment')
        batch_op.drop_column('rider_rating')
        batch_op.drop_column('estimated_minutes')
        batch_op.drop_column('surge_bonus_cents')
        batch_op.drop_column('distance_pay_cents')
        batch_op.drop_column('base_fare_cents')
