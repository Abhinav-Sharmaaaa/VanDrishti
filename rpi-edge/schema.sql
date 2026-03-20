CREATE TABLE IF NOT EXISTS api_cache (
    key        TEXT        PRIMARY KEY,
    value      JSONB       NOT NULL,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS zone_snapshots (
    id             BIGSERIAL    PRIMARY KEY,
    zone_id        TEXT         NOT NULL,
    device_id      TEXT         NOT NULL,
    fhi            NUMERIC(5,1) NOT NULL,
    status         TEXT         NOT NULL,
    signals        JSONB        NOT NULL,
    weather        JSONB        NOT NULL,
    fire           JSONB        NOT NULL,
    species        JSONB        NOT NULL,
    tree_cover     JSONB        NOT NULL,
    data_source    JSONB        NOT NULL,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_zone_time
    ON zone_snapshots (zone_id, created_at DESC);

CREATE TABLE IF NOT EXISTS sync_queue (
    id         BIGSERIAL   PRIMARY KEY,
    payload    JSONB       NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    attempts   SMALLINT    NOT NULL DEFAULT 0
);