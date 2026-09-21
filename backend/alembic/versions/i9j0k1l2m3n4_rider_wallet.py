"""rider wallet and transactions
Revision ID: i9j0k1l2m3n4
Revises: h8i9j0k1l2m3
"""
from alembic import op
import sqlalchemy as sa
revision = 'i9j0k1l2m3n4'
down_revision = 'h8i9j0k1l2m3'

def upgrade():
    op.create_table(
        'rider_wallets',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('rider_id', sa.Integer(), nullable=False),
        sa.Column('total_balance_cents', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('locked_balance_cents', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('available_balance_cents', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['rider_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('rider_id'),
    )
    op.create_table(
        'wallet_transactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('rider_id', sa.Integer(), nullable=False),
        sa.Column('txn_type', sa.String(length=32), nullable=False),
        sa.Column('amount_cents', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=24), nullable=False, server_default='completed'),
        sa.Column('reference_number', sa.String(length=32), nullable=False, server_default=''),
        sa.Column('title', sa.String(length=128), nullable=False),
        sa.Column('subtitle', sa.String(length=255), nullable=False, server_default=''),
        sa.Column('order_id', sa.Integer(), nullable=True),
        sa.Column('fee_cents', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['rider_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_wallet_transactions_rider_id', 'wallet_transactions', ['rider_id'])

def downgrade():
    op.drop_index('ix_wallet_transactions_rider_id', table_name='wallet_transactions')
    op.drop_table('wallet_transactions')
    op.drop_table('rider_wallets')
