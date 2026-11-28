"""one wallet per rider (unique index the model already declares)
Revision ID: t0u1v2w3x4y5
Revises: s9t0u1v2w3x4
"""
from alembic import op
import sqlalchemy as sa

revision = 't0u1v2w3x4y5'
down_revision = 's9t0u1v2w3x4'


def upgrade():
    conn = op.get_bind()
    # Concurrent first loads could create duplicate wallets; merge them into the
    # oldest row (balances are additive) so the unique index can be created.
    dupes = conn.execute(sa.text(
        "SELECT rider_id FROM rider_wallets GROUP BY rider_id HAVING COUNT(*) > 1"
    )).scalars().all()
    for rider_id in dupes:
        rows = conn.execute(sa.text(
            "SELECT id, total_balance_cents FROM rider_wallets WHERE rider_id = :r ORDER BY id"
        ), {"r": rider_id}).all()
        keep = rows[0][0]
        total = sum(r[1] or 0 for r in rows)
        conn.execute(sa.text(
            "UPDATE rider_wallets SET total_balance_cents = :t WHERE id = :id"
        ), {"t": total, "id": keep})
        conn.execute(sa.text(
            "DELETE FROM rider_wallets WHERE rider_id = :r AND id <> :id"
        ), {"r": rider_id, "id": keep})

    insp = sa.inspect(conn)
    existing = {ix['name'] for ix in insp.get_indexes('rider_wallets')}
    if 'ix_rider_wallets_rider_id' in existing:
        op.drop_index('ix_rider_wallets_rider_id', table_name='rider_wallets')
    op.create_index('ix_rider_wallets_rider_id', 'rider_wallets', ['rider_id'], unique=True)


def downgrade():
    op.drop_index('ix_rider_wallets_rider_id', table_name='rider_wallets')
