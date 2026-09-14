CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS operators (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS batches (
    id SERIAL PRIMARY KEY,
    filename TEXT NOT NULL,
    uploaded_by TEXT NOT NULL,
    rows_total INT NOT NULL,
    rows_new INT NOT NULL,
    rows_duplicate INT NOT NULL,
    rows_invalid INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per company. The normalized domain is the idempotency key.
CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    domain TEXT NOT NULL UNIQUE,
    first_batch_id INT REFERENCES batches(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS batch_accounts (
    batch_id INT NOT NULL REFERENCES batches(id),
    account_id INT NOT NULL REFERENCES accounts(id),
    PRIMARY KEY (batch_id, account_id)
);

-- One row per research run. thread_id is the LangGraph checkpoint thread.
CREATE TABLE IF NOT EXISTS runs (
    id UUID PRIMARY KEY,
    account_id INT NOT NULL REFERENCES accounts(id),
    status TEXT NOT NULL,           -- running | pending_approval | approved | rejected | refused | failed
    status_reason TEXT,
    facts JSONB NOT NULL DEFAULT '[]',
    icp JSONB,
    brief JSONB,
    validation JSONB,
    providers JSONB NOT NULL DEFAULT '{}',
    decision TEXT,
    decided_by TEXT,
    decided_at TIMESTAMPTZ,
    decision_reason TEXT,
    final_brief JSONB,
    tokens_in INT NOT NULL DEFAULT 0,
    tokens_out INT NOT NULL DEFAULT 0,
    grounded_requests INT NOT NULL DEFAULT 0,
    cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS runs_account_idx ON runs(account_id);
CREATE INDEX IF NOT EXISTS runs_status_idx ON runs(status);

-- Raw text of every source used, so claims can be re-verified later.
CREATE TABLE IF NOT EXISTS source_documents (
    id SERIAL PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES runs(id),
    url TEXT NOT NULL,
    provider TEXT NOT NULL,
    http_status INT,
    error TEXT,
    text TEXT NOT NULL DEFAULT '',
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS source_documents_run_idx ON source_documents(run_id);

CREATE TABLE IF NOT EXISTS trace_events (
    id BIGSERIAL PRIMARY KEY,
    run_id UUID NOT NULL REFERENCES runs(id),
    node TEXT NOT NULL,
    event TEXT NOT NULL,
    latency_ms INT,
    tokens_in INT,
    tokens_out INT,
    data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trace_events_run_idx ON trace_events(run_id);
