"""rider profile details

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-09-18
"""
from alembic import op
import sqlalchemy as sa

revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('rider_profiles', schema=None) as batch_op:
        batch_op.add_column(sa.Column('partner_code', sa.String(length=32), nullable=True))
        batch_op.add_column(sa.Column('rating', sa.Float(), nullable=False, server_default='5.0'))
        batch_op.add_column(sa.Column('vehicle_model', sa.String(length=128), nullable=False, server_default=''))
        batch_op.add_column(sa.Column('vehicle_fuel_type', sa.String(length=32), nullable=False, server_default='Petrol'))
        batch_op.add_column(sa.Column('vehicle_cargo_type', sa.String(length=64), nullable=False, server_default='Standard Cargo Box'))
        batch_op.add_column(sa.Column('rc_status', sa.String(length=32), nullable=False, server_default='active'))
        batch_op.add_column(sa.Column('phone_verified', sa.Boolean(), nullable=False, server_default='0'))
        batch_op.add_column(sa.Column('operating_hub', sa.String(length=255), nullable=False, server_default=''))
        batch_op.add_column(sa.Column('fleet_tier', sa.String(length=64), nullable=False, server_default='Tier 1 Gold Fleet'))
        batch_op.add_column(sa.Column('surge_priority_pct', sa.Integer(), nullable=False, server_default='10'))
        batch_op.add_column(sa.Column('bank_name', sa.String(length=64), nullable=False, server_default=''))
        batch_op.add_column(sa.Column('bank_account_masked', sa.String(length=32), nullable=False, server_default=''))
        batch_op.add_column(sa.Column('upi_linked', sa.Boolean(), nullable=False, server_default='0'))
        batch_op.add_column(sa.Column('app_language', sa.String(length=64), nullable=False, server_default='English'))
        batch_op.add_column(sa.Column('documents_valid_until', sa.String(length=16), nullable=False, server_default='2026'))
        batch_op.create_index(batch_op.f('ix_rider_profiles_partner_code'), ['partner_code'], unique=True)

    with op.batch_alter_table('rider_documents', schema=None) as batch_op:
        batch_op.add_column(sa.Column('expires_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('rider_documents', schema=None) as batch_op:
        batch_op.drop_column('expires_at')

    with op.batch_alter_table('rider_profiles', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_rider_profiles_partner_code'))
        batch_op.drop_column('documents_valid_until')
        batch_op.drop_column('app_language')
        batch_op.drop_column('upi_linked')
        batch_op.drop_column('bank_account_masked')
        batch_op.drop_column('bank_name')
        batch_op.drop_column('surge_priority_pct')
        batch_op.drop_column('fleet_tier')
        batch_op.drop_column('operating_hub')
        batch_op.drop_column('phone_verified')
        batch_op.drop_column('rc_status')
        batch_op.drop_column('vehicle_cargo_type')
        batch_op.drop_column('vehicle_fuel_type')
        batch_op.drop_column('vehicle_model')
        batch_op.drop_column('rating')
        batch_op.drop_column('partner_code')
