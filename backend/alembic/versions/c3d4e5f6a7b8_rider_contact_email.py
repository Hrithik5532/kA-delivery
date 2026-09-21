"""rider contact email
Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
"""
from alembic import op
import sqlalchemy as sa
revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'

def upgrade():
    with op.batch_alter_table('rider_profiles', schema=None) as batch_op:
        batch_op.add_column(sa.Column('contact_email', sa.String(length=255), nullable=True))

def downgrade():
    with op.batch_alter_table('rider_profiles', schema=None) as batch_op:
        batch_op.drop_column('contact_email')
