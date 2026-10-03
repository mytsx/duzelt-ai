export const TOKEN_CLAIM_TTL_MS = 86_400_000;

// This module stays independent of the Workers class so the storage contract
// can also be exercised in the existing Node test harness.
export class TokenClaims {
    constructor(storage, now = Date.now) {
        this.storage = storage;
        this.now = now;
        this.ensureSchema();
    }

    ensureSchema() {
        this.storage.sql.exec(`CREATE TABLE IF NOT EXISTS token_claim (
            id INTEGER PRIMARY KEY CHECK (id = 1), expires_at INTEGER NOT NULL
        )`);
    }

    async claim() {
        // deleteAll() removes the schema too; the same live instance may be
        // called again after its expiry alarm, so recreate it when needed.
        this.ensureSchema();
        const now = this.now();
        // No await occurs within the read/write transaction. Concurrent RPCs
        // can therefore accept this hash only once, including after restarts.
        const { claimed, nextExpiry } = this.storage.transactionSync(() => {
            this.storage.sql.exec('DELETE FROM token_claim WHERE expires_at <= ?', now);
            const rows = this.storage.sql.exec(
                'INSERT INTO token_claim (id, expires_at) VALUES (1, ?) ON CONFLICT(id) DO NOTHING RETURNING id',
                now + TOKEN_CLAIM_TTL_MS,
            ).toArray();
            const nextExpiry = this.storage.sql.exec('SELECT expires_at FROM token_claim WHERE id = 1').one().expires_at;
            return { claimed: rows.length === 1, nextExpiry };
        });
        // Await durable alarm scheduling before acknowledging the claim.
        await this.storage.setAlarm(nextExpiry);
        return claimed;
    }

    async prune() {
        this.ensureSchema();
        const row = this.storage.sql.exec('SELECT expires_at FROM token_claim WHERE id = 1').toArray()[0];
        if (!row || row.expires_at <= this.now()) await this.storage.deleteAll();
        else await this.storage.setAlarm(row.expires_at);
    }
}
