"""python -m paladin.cli migrate | seed | ingest | run | decide | export | run-eval | serve"""

from __future__ import annotations

import argparse
import getpass
import json
import os
import runpy
import sys
from pathlib import Path

from .config import ROOT, get_settings
from .db import connect, migrate
from .trace import setup_logging


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="paladin")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("migrate")
    s = sub.add_parser("seed", help="create or reset the demo operator")
    s.add_argument("--username", default=os.getenv("PALADIN_OPERATOR_USER", "operator"))
    i = sub.add_parser("ingest")
    i.add_argument("csv")
    r = sub.add_parser("run", help="ingest a CSV (optional) and research every account in the batch")
    r.add_argument("--csv")
    r.add_argument("--batch", type=int)
    r.add_argument("--force", action="store_true", help="re-run accounts that already have a decision")
    d = sub.add_parser("decide")
    d.add_argument("run_id")
    d.add_argument("action", choices=["approve", "reject"])
    d.add_argument("--by", required=True)
    d.add_argument("--reason")
    e = sub.add_parser("export")
    e.add_argument("--out", default="-")
    sub.add_parser("run-eval")
    sv = sub.add_parser("serve")
    sv.add_argument("--port", type=int, default=8000)
    args = p.parse_args(argv)

    settings = get_settings()
    setup_logging(settings.log_dir)

    if args.cmd == "migrate":
        print(json.dumps({"applied": migrate(settings.database_url)}))
    elif args.cmd == "seed":
        from .auth import seed_operator

        password = os.getenv("PALADIN_OPERATOR_PASSWORD") or getpass.getpass("operator password: ")
        with connect(settings.database_url) as conn:
            seed_operator(conn, args.username, password)
        print(json.dumps({"seeded": args.username}))
    elif args.cmd == "ingest":
        from .ingest import ingest

        with connect(settings.database_url) as conn:
            print(json.dumps(ingest(conn, Path(args.csv).name, Path(args.csv).read_bytes(), "cli")))
    elif args.cmd == "run":
        from .ingest import ingest
        from .runner import Runner, make_deps, run_batch

        deps = make_deps(settings)
        batch_id = args.batch
        if args.csv:
            res = ingest(deps.conn, Path(args.csv).name, Path(args.csv).read_bytes(), "cli")
            print(json.dumps({k: v for k, v in res.items() if k != "invalid"}))
            batch_id = res["batch_id"]
        if batch_id is None:
            p.error("run needs --csv or --batch")
        results = run_batch(Runner(deps), batch_id, force=args.force)
        print(json.dumps(results, default=str, indent=2))
    elif args.cmd == "decide":
        from .runner import Runner, make_deps

        deps = make_deps(settings)
        print(json.dumps({"status": Runner(deps).decide(args.run_id, args.action, args.by, args.reason)}))
    elif args.cmd == "export":
        from .export import approved_rows, to_hubspot_csv

        with connect(settings.database_url) as conn:
            body = to_hubspot_csv(approved_rows(conn))
        if args.out == "-":
            sys.stdout.write(body)
        else:
            Path(args.out).write_text(body)
    elif args.cmd == "run-eval":
        sys.argv = [str(ROOT / "eval" / "run_eval.py")]
        runpy.run_path(str(ROOT / "eval" / "run_eval.py"), run_name="__main__")
    elif args.cmd == "serve":
        import uvicorn

        uvicorn.run("paladin.web:app", host="127.0.0.1", port=args.port)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
