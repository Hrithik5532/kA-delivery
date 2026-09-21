"""rider earnings enhancements
Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
"""
from alembic import op
import sqlalchemy as sa
revision = 'f6a7b8c9d0e1'
down_revision = 'e5f6a7b8c9d0'

def upgrade():
    with op.batch_alter_table('deliveries', schema=None) as batch_op:
        batch_op.add_column(sa.Column('active_minutes', sa.Integer(), nullable=True))
    op.create_table(
        'rider_incentives',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('rider_id', sa.Integer(), nullable=False),
        sa.Column('incentive_type', sa.String(length=48), nullable=False),
        sa.Column('title', sa.String(length=128), nullable=False),
        sa.Column('subtitle', sa.String(length=255), nullable=False, server_default=''),
        sa.Column('target_value', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('current_value', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('bonus_cents', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('status', sa.String(length=24), nullable=False, server_default='active'),
        sa.Column('ends_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['rider_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_rider_incentives_rider_id', 'rider_incentives', ['rider_id'])
    op.create_table(
        'rider_cashouts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('rider_id', sa.Integer(), nullable=False),
        sa.Column('amount_cents', sa.Integer(), nullable=False),
        sa.Column('fee_cents', sa.Integer(), nullable=False, server_default='500'),
        sa.Column('status', sa.String(length=24), nullable=False, server_default='completed'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['rider_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_rider_cashouts_rider_id', 'rider_cashouts', ['rider_id'])

def downgrade():
    op.drop_index('ix_rider_cashouts_rider_id', table_name='rider_cashouts')
    op.drop_table('rider_cashouts')
    op.drop_index('ix_rider_incentives_rider_id', table_name='rider_incentives')
    op.drop_table('rider_incentives')
    with op.batch_alter_table('deliveries', schema=None) as batch_op:
        batch_op.drop_column('active_minutes')
