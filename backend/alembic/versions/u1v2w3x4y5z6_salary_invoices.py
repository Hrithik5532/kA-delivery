"""monthly salary for partners + salary invoices
Revision ID: u1v2w3x4y5z6
Revises: t0u1v2w3x4y5
"""
from alembic import op
import sqlalchemy as sa

revision = 'u1v2w3x4y5z6'
down_revision = 't0u1v2w3x4y5'


def upgrade():
    with op.batch_alter_table('rider_profiles') as b:
        b.add_column(sa.Column('monthly_salary_cents', sa.Integer(), nullable=True))
    op.create_table(
        'salary_invoices',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('rider_id', sa.Integer(), nullable=False),
        sa.Column('period', sa.String(length=7), nullable=False),
        sa.Column('invoice_number', sa.String(length=40), nullable=False),
        sa.Column('base_salary_cents', sa.Integer(), nullable=False),
        sa.Column('additions_cents', sa.Integer(), nullable=False),
        sa.Column('deductions_cents', sa.Integer(), nullable=False),
        sa.Column('net_cents', sa.Integer(), nullable=False),
        sa.Column('deliveries_count', sa.Integer(), nullable=False),
        sa.Column('days_active', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=16), nullable=False),
        sa.Column('notes', sa.String(length=1000), nullable=False),
        sa.Column('payment_reference', sa.String(length=128), nullable=True),
        sa.Column('created_by_user_id', sa.Integer(), nullable=True),
        sa.Column('approved_by_user_id', sa.Integer(), nullable=True),
        sa.Column('approved_at', sa.DateTime(), nullable=True),
        sa.Column('paid_at', sa.DateTime(), nullable=True),
        sa.Column('cancelled_reason', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['rider_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['approved_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('rider_id', 'period', name='uq_salary_rider_period'),
        sa.UniqueConstraint('invoice_number'),
    )
    op.create_index('ix_salary_invoices_rider_id', 'salary_invoices', ['rider_id'])
    op.create_index('ix_salary_invoices_period', 'salary_invoices', ['period'])
    op.create_index('ix_salary_invoices_status', 'salary_invoices', ['status'])


def downgrade():
    op.drop_index('ix_salary_invoices_status', table_name='salary_invoices')
    op.drop_index('ix_salary_invoices_period', table_name='salary_invoices')
    op.drop_index('ix_salary_invoices_rider_id', table_name='salary_invoices')
    op.drop_table('salary_invoices')
    with op.batch_alter_table('rider_profiles') as b:
        b.drop_column('monthly_salary_cents')
