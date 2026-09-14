from paladin.ingest import ingest, normalize_domain

CSV = "company name,domain\nLinear,https://www.Linear.app/about\nPostHog,posthog.com\nLinear again,linear.app\nBroken,not a domain\n"


def test_normalize_domain():
    assert normalize_domain("https://WWW.Linear.app/about?x=1") == "linear.app"
    assert normalize_domain("posthog.com/") == "posthog.com"
    assert normalize_domain("not a domain") is None
    assert normalize_domain("") is None


def test_reupload_does_not_duplicate(conn):
    first = ingest(conn, "list.csv", CSV, "test")
    assert first["rows_new"] == 2
    assert first["rows_duplicate"] == 1  # in-file duplicate of linear.app
    assert first["rows_invalid"] == 1

    second = ingest(conn, "list.csv", CSV, "test")
    assert second["rows_new"] == 0
    assert second["rows_duplicate"] == 3

    assert conn.execute("SELECT count(*) c FROM accounts").fetchone()["c"] == 2
    # Both batches still point at the same two accounts.
    links = conn.execute("SELECT batch_id, count(*) c FROM batch_accounts GROUP BY batch_id ORDER BY batch_id").fetchall()
    assert [r["c"] for r in links] == [2, 2]
