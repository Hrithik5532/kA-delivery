"""support help enhancements

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
"""
from alembic import op
import sqlalchemy as sa

revision = 'd4e5f6a7b8c9'
down_revision = 'c3d4e5f6a7b8'

def upgrade():
    with op.batch_alter_table('support_tickets', schema=None) as batch_op:
        batch_op.add_column(sa.Column('ticket_number', sa.String(length=24), nullable=True))
        batch_op.add_column(sa.Column('topic', sa.String(length=64), nullable=False, server_default='general'))
        batch_op.add_column(sa.Column('title', sa.String(length=255), nullable=False, server_default=''))
        batch_op.add_column(sa.Column('order_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('attachment_path', sa.String(length=512), nullable=True))
        batch_op.add_column(sa.Column('attachment_name', sa.String(length=255), nullable=True))
        batch_op.create_index(batch_op.f('ix_support_tickets_ticket_number'), ['ticket_number'], unique=True)

    op.create_table(
        'support_faqs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('category', sa.String(length=48), nullable=False),
        sa.Column('question', sa.String(length=500), nullable=False),
        sa.Column('answer', sa.Text(), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('support_faqs', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_support_faqs_category'), ['category'], unique=False)

def downgrade():
    op.drop_table('support_faqs')
    with op.batch_alter_table('support_tickets', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_support_tickets_ticket_number'))
        batch_op.drop_column('attachment_name')
        batch_op.drop_column('attachment_path')
        batch_op.drop_column('order_id')
        batch_op.drop_column('title')
        batch_op.drop_column('topic')
        batch_op.drop_column('ticket_number')
