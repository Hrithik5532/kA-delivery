"""active delivery tracking fields
Revision ID: j0k1l2m3n4o5
Revises: i9j0k1l2m3n4
"""
from alembic import op
import sqlalchemy as sa

revision = 'j0k1l2m3n4o5'
down_revision = 'i9j0k1l2m3n4'


def upgrade():
    op.add_column('orders', sa.Column('address_title', sa.String(128), server_default='', nullable=False))
    op.add_column('orders', sa.Column('address_subtitle', sa.String(255), server_default='', nullable=False))
    op.add_column('orders', sa.Column('address_tag', sa.String(64), server_default='', nullable=False))
    op.add_column('orders', sa.Column('customer_note', sa.String(512), server_default='', nullable=False))
    op.add_column('orders', sa.Column('customer_verified', sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column('deliveries', sa.Column('eta_minutes', sa.Integer(), nullable=True))
    op.add_column('deliveries', sa.Column('distance_remaining_km', sa.Float(), nullable=True))
    op.add_column('deliveries', sa.Column('route_label', sa.String(32), server_default='', nullable=False))
    op.add_column('deliveries', sa.Column('deliver_by_at', sa.DateTime(), nullable=True))
    op.add_column('deliveries', sa.Column('arrived_at_drop_at', sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column('deliveries', 'arrived_at_drop_at')
    op.drop_column('deliveries', 'deliver_by_at')
    op.drop_column('deliveries', 'route_label')
    op.drop_column('deliveries', 'distance_remaining_km')
    op.drop_column('deliveries', 'eta_minutes')
    op.drop_column('orders', 'customer_verified')
    op.drop_column('orders', 'customer_note')
    op.drop_column('orders', 'address_tag')
    op.drop_column('orders', 'address_subtitle')
    op.drop_column('orders', 'address_title')
