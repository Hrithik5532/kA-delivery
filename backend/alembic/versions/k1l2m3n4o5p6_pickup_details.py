"""pickup detail fields
Revision ID: k1l2m3n4o5p6
Revises: j0k1l2m3n4o5
"""
from alembic import op
import sqlalchemy as sa

revision = 'k1l2m3n4o5p6'
down_revision = 'j0k1l2m3n4o5'


def upgrade():
    op.add_column('messes', sa.Column('is_pure_veg', sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column('messes', sa.Column('pickup_counter_label', sa.String(64), server_default='', nullable=False))
    op.add_column('messes', sa.Column('contact_phone', sa.String(32), server_default='', nullable=False))
    op.add_column('messes', sa.Column('pickup_note', sa.String(512), server_default='', nullable=False))
    op.add_column('order_items', sa.Column('packaging_note', sa.String(255), server_default='', nullable=False))
    op.add_column('deliveries', sa.Column('pickup_eta_minutes', sa.Integer(), nullable=True))
    op.add_column('deliveries', sa.Column('pickup_distance_km', sa.Float(), nullable=True))
    op.add_column('deliveries', sa.Column('pickup_route_label', sa.String(64), server_default='', nullable=False))
    op.add_column('deliveries', sa.Column('pickup_track_status', sa.String(32), server_default='on_track', nullable=False))
    op.add_column('deliveries', sa.Column('pickup_progress_pct', sa.Integer(), server_default='0', nullable=False))
    op.add_column('deliveries', sa.Column('merchant_pickup_note', sa.String(512), server_default='', nullable=False))
    op.add_column('deliveries', sa.Column('pickup_counter', sa.String(64), server_default='', nullable=False))
    op.add_column('deliveries', sa.Column('packaging_verified', sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column('deliveries', sa.Column('food_ready', sa.Boolean(), server_default=sa.true(), nullable=False))
    op.add_column('deliveries', sa.Column('arrived_at_pickup_at', sa.DateTime(), nullable=True))
    op.add_column('deliveries', sa.Column('verified_item_keys', sa.String(512), server_default='', nullable=False))


def downgrade():
    for col in [
        'verified_item_keys', 'arrived_at_pickup_at', 'food_ready', 'packaging_verified',
        'pickup_counter', 'merchant_pickup_note', 'pickup_progress_pct', 'pickup_track_status',
        'pickup_route_label', 'pickup_distance_km', 'pickup_eta_minutes',
    ]:
        op.drop_column('deliveries', col)
    op.drop_column('order_items', 'packaging_note')
    for col in ['pickup_note', 'contact_phone', 'pickup_counter_label', 'is_pure_veg']:
        op.drop_column('messes', col)
