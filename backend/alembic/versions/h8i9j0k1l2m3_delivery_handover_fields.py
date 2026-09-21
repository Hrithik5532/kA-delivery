"""delivery handover fields
Revision ID: h8i9j0k1l2m3
Revises: g7h8i9j0k1l2
"""
from alembic import op
import sqlalchemy as sa
revision = 'h8i9j0k1l2m3'
down_revision = 'g7h8i9j0k1l2'

def upgrade():
    with op.batch_alter_table('deliveries', schema=None) as batch_op:
        batch_op.add_column(sa.Column('handover_type', sa.String(length=48), nullable=False, server_default='doorstep'))
        batch_op.add_column(sa.Column('handover_instructions', sa.String(length=512), nullable=False, server_default=''))
        batch_op.add_column(sa.Column('priority_note', sa.String(length=128), nullable=False, server_default=''))
        batch_op.add_column(sa.Column('delivery_photo_path', sa.String(length=512), nullable=True))
        batch_op.add_column(sa.Column('delivery_photo_name', sa.String(length=255), nullable=True))
        batch_op.add_column(sa.Column('otp_verified_at', sa.DateTime(), nullable=True))

def downgrade():
    with op.batch_alter_table('deliveries', schema=None) as batch_op:
        batch_op.drop_column('otp_verified_at')
        batch_op.drop_column('delivery_photo_name')
        batch_op.drop_column('delivery_photo_path')
        batch_op.drop_column('priority_note')
        batch_op.drop_column('handover_instructions')
        batch_op.drop_column('handover_type')
