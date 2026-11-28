"""rider shift slots, manual external-courier details, OTP attempt limit
Revision ID: s9t0u1v2w3x4
Revises: r8s9t0u1v2w3
"""
from datetime import datetime, timezone

from alembic import op
import sqlalchemy as sa

revision = 's9t0u1v2w3x4'
down_revision = 'r8s9t0u1v2w3'


def upgrade():
    slots = op.create_table(
        'shift_slots',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=64), nullable=False),
        sa.Column('start_time', sa.String(length=5), nullable=False),
        sa.Column('end_time', sa.String(length=5), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('max_riders', sa.Integer(), nullable=True),
        sa.Column('sort_order', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_shift_slots_is_active', 'shift_slots', ['is_active'])
    op.create_table(
        'rider_shift_slots',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('rider_id', sa.Integer(), nullable=False),
        sa.Column('slot_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['rider_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['slot_id'], ['shift_slots.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('rider_id', 'slot_id', name='uq_rider_shift_slot'),
    )
    op.create_index('ix_rider_shift_slots_rider_id', 'rider_shift_slots', ['rider_id'])
    op.create_index('ix_rider_shift_slots_slot_id', 'rider_shift_slots', ['slot_id'])

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    op.bulk_insert(slots, [
        {'name': 'Lunch', 'start_time': '11:00', 'end_time': '14:00', 'is_active': True,
         'max_riders': None, 'sort_order': 1, 'created_at': now, 'updated_at': now},
        {'name': 'Dinner', 'start_time': '19:00', 'end_time': '22:00', 'is_active': True,
         'max_riders': None, 'sort_order': 2, 'created_at': now, 'updated_at': now},
    ])

    with op.batch_alter_table('rider_profiles') as b:
        b.add_column(sa.Column('shift_auto_online_key', sa.String(length=32), nullable=True))

    with op.batch_alter_table('orders') as b:
        b.add_column(sa.Column('external_rider_name', sa.String(length=128), nullable=True))
        b.add_column(sa.Column('external_rider_phone', sa.String(length=32), nullable=True))
        b.add_column(sa.Column('external_vehicle_type', sa.String(length=32), nullable=True))
        b.add_column(sa.Column('external_vehicle_number', sa.String(length=32), nullable=True))
        b.add_column(sa.Column('external_tracking_url', sa.String(length=512), nullable=True))

    with op.batch_alter_table('login_otps') as b:
        b.add_column(sa.Column('attempts', sa.Integer(), nullable=False, server_default='0'))


def downgrade():
    with op.batch_alter_table('login_otps') as b:
        b.drop_column('attempts')
    with op.batch_alter_table('orders') as b:
        for col in ('external_tracking_url', 'external_vehicle_number', 'external_vehicle_type',
                    'external_rider_phone', 'external_rider_name'):
            b.drop_column(col)
    with op.batch_alter_table('rider_profiles') as b:
        b.drop_column('shift_auto_online_key')
    op.drop_index('ix_rider_shift_slots_slot_id', table_name='rider_shift_slots')
    op.drop_index('ix_rider_shift_slots_rider_id', table_name='rider_shift_slots')
    op.drop_table('rider_shift_slots')
    op.drop_index('ix_shift_slots_is_active', table_name='shift_slots')
    op.drop_table('shift_slots')
