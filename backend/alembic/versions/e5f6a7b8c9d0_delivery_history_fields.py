"""delivery history fields
Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
"""
from alembic import op
import sqlalchemy as sa
revision = 'e5f6a7b8c9d0'
down_revision = 'd4e5f6a7b8c9'

def upgrade():
    with op.batch_alter_table('deliveries', schema=None) as batch_op:
        batch_op.add_column(sa.Column('tip_cents', sa.Integer(), nullable=False, server_default='0'))
        batch_op.add_column(sa.Column('surge_multiplier', sa.Float(), nullable=False, server_default='1.0'))
        batch_op.add_column(sa.Column('distance_km', sa.Float(), nullable=True))

def downgrade():
    with op.batch_alter_table('deliveries', schema=None) as batch_op:
        batch_op.drop_column('distance_km')
        batch_op.drop_column('surge_multiplier')
        batch_op.drop_column('tip_cents')
