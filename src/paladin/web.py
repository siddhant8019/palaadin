"""FastAPI app: server-rendered pages plus a small JSON API."""

from __future__ import annotations

import base64
import threading
from pathlib import Path

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse, PlainTextResponse, RedirectResponse, Response
from fastapi.templating import Jinja2Templates

from . import auth
from .config import get_settings
from .db import connect
from .export import approved_rows, to_hubspot_csv
from .ingest import ingest
from .runner import Runner, make_deps, run_batch
from .trace import setup_logging

settings = get_settings()
setup_logging(settings.log_dir)
templates = Jinja2Templates(directory=str(Path(__file__).parent / "templates"))
app = FastAPI(title="PALADIN", docs_url=None, redoc_url=None)
_running_batches: set[int] = set()
_lock = threading.Lock()


def db():
    return connect(settings.database_url)


def current_user(request: Request) -> str | None:
    user = auth.read_session(settings.session_secret, request.cookies.get(auth.COOKIE))
    if user:
        return user
    header = request.headers.get("authorization", "")
    if header.lower().startswith("basic "):
        try:
            username, _, password = base64.b64decode(header[6:]).decode().partition(":")
        except ValueError:
            return None
        with db() as conn:
            if auth.authenticate(conn, username, password):
                return username
    return None


def require_user(request: Request) -> str:
    user = current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="login required")
    return user


@app.exception_handler(HTTPException)
async def http_error(request: Request, exc: HTTPException):
    if exc.status_code == 401 and not request.url.path.startswith("/api/"):
        return RedirectResponse("/login", status_code=303)
    return JSONResponse({"error": exc.detail}, status_code=exc.status_code)


@app.get("/healthz")
def healthz():
    return {"ok": True}


@app.get("/login", response_class=HTMLResponse)
def login_page(request: Request, error: str | None = None):
    return templates.TemplateResponse(request, "login.html", {"error": error})


@app.post("/login")
def login(username: str = Form(...), password: str = Form(...)):
    with db() as conn:
        ok = auth.authenticate(conn, username, password)
    if not ok:
        return RedirectResponse("/login?error=Wrong+username+or+password", status_code=303)
    resp = RedirectResponse("/", status_code=303)
    resp.set_cookie(auth.COOKIE, auth.signer(settings.session_secret).dumps(username), httponly=True,
                    samesite="lax", max_age=auth.MAX_AGE)
    return resp


@app.post("/logout")
def logout():
    resp = RedirectResponse("/login", status_code=303)
    resp.delete_cookie(auth.COOKIE)
    return resp


def _batches(conn):
    return conn.execute(
        "SELECT b.*, "
        " (SELECT json_object_agg(s, c) FROM (SELECT r.status s, count(DISTINCT r.account_id) c FROM runs r"
        "   JOIN batch_accounts ba ON ba.account_id = r.account_id WHERE ba.batch_id = b.id GROUP BY r.status) x) AS statuses"
        " FROM batches b ORDER BY b.id DESC LIMIT 10"
    ).fetchall()


@app.get("/", response_class=HTMLResponse)
def home(request: Request, msg: str | None = None):
    user = require_user(request)
    with db() as conn:
        batches = _batches(conn)
        pending = conn.execute("SELECT count(*) c FROM runs WHERE status = 'pending_approval'").fetchone()["c"]
    return templates.TemplateResponse(request, "home.html", {"user": user, "batches": batches, "pending": pending,
                                                             "msg": msg, "running": set(_running_batches)})


def _process_batch(batch_id: int, force: bool = False) -> None:
    with _lock:
        if batch_id in _running_batches:
            return
        _running_batches.add(batch_id)
    try:
        deps = make_deps(settings)
        runner = Runner(deps)
        try:
            run_batch(runner, batch_id, force=force)
        finally:
            runner.close()
            deps.conn.close()
    finally:
        with _lock:
            _running_batches.discard(batch_id)


@app.post("/upload")
async def upload(request: Request, file: UploadFile = File(...)):
    user = require_user(request)
    content = await file.read()
    try:
        with db() as conn:
            result = ingest(conn, file.filename or "upload.csv", content, user)
    except ValueError as exc:
        return RedirectResponse(f"/?msg=Upload+failed:+{exc}", status_code=303)
    msg = (f"Batch {result['batch_id']}: {result['rows_new']} new, {result['rows_duplicate']} already known,"
           f" {result['rows_invalid']} invalid")
    return RedirectResponse(f"/?msg={msg}", status_code=303)


@app.post("/batches/{batch_id}/run")
def start_batch(request: Request, batch_id: int, background: BackgroundTasks):
    require_user(request)
    background.add_task(_process_batch, batch_id)
    return RedirectResponse(f"/?msg=Research+started+for+batch+{batch_id}", status_code=303)


def _load_run(conn, run_id: str):
    run = conn.execute(
        "SELECT r.*, a.name, a.domain FROM runs r JOIN accounts a ON a.id = r.account_id WHERE r.id = %s", (run_id,)
    ).fetchone()
    if not run:
        raise HTTPException(404, "run not found")
    return run


@app.get("/queue", response_class=HTMLResponse)
def queue(request: Request, msg: str | None = None):
    user = require_user(request)
    with db() as conn:
        pending = conn.execute(
            "SELECT r.*, a.name, a.domain FROM runs r JOIN accounts a ON a.id = r.account_id"
            " WHERE r.status = 'pending_approval' ORDER BY (r.icp->>'total')::int DESC NULLS LAST, r.created_at"
        ).fetchall()
        decided = conn.execute(
            "SELECT r.id, r.status, r.status_reason, r.decided_by, r.decision_reason, a.domain FROM runs r"
            " JOIN accounts a ON a.id = r.account_id WHERE r.status <> 'pending_approval' AND r.status <> 'running'"
            " ORDER BY r.updated_at DESC LIMIT 15"
        ).fetchall()
    return templates.TemplateResponse(request, "queue.html", {"user": user, "pending": pending, "decided": decided,
                                                              "msg": msg})


@app.post("/runs/{run_id}/decision")
def decision(request: Request, run_id: str, action: str = Form(...), reason: str = Form(""),
             first_line: str = Form(""), summary: str = Form("")):
    user = require_user(request)
    deps = make_deps(settings)
    try:
        run = _load_run(deps.conn, run_id)
        edited = None
        if action == "approve":
            original = run["brief"] or {}
            orig_summary = "\n".join(c["text"] for c in original.get("summary") or [])
            orig_first = (original.get("first_line") or {}).get("text", "")
            if summary.strip() != orig_summary.strip() or first_line.strip() != orig_first.strip():
                # Unchanged lines keep their citations; lines the human wrote or changed carry none and
                # are marked, so the export shows which text is not machine-verified.
                ids_by_text = {c["text"].strip(): c["fact_ids"] for c in original.get("summary") or []}
                if original.get("first_line"):
                    ids_by_text[orig_first.strip()] = original["first_line"]["fact_ids"]

                def claim(text):
                    ids = ids_by_text.get(text)
                    return {"text": text, "fact_ids": ids or [], "human_written": ids is None}

                edited = {
                    "summary": [claim(line.strip()) for line in summary.splitlines() if line.strip()],
                    "first_line": claim(first_line.strip()) if first_line.strip() else None,
                }
        runner = Runner(deps)
        try:
            status = runner.decide(run_id, action, user, reason or None, edited)
        finally:
            runner.close()
    except (ValueError, LookupError) as exc:
        return RedirectResponse(f"/queue?msg=Not+saved:+{exc}", status_code=303)
    finally:
        deps.conn.close()
    return RedirectResponse(f"/queue?msg={run['domain']}+{status}", status_code=303)


@app.get("/runs/{run_id}", response_class=HTMLResponse)
def run_page(request: Request, run_id: str):
    user = require_user(request)
    with db() as conn:
        run = _load_run(conn, run_id)
        events = conn.execute("SELECT * FROM trace_events WHERE run_id = %s ORDER BY id", (run_id,)).fetchall()
    return templates.TemplateResponse(request, "run.html", {"user": user, "run": run, "events": events})


@app.get("/export.csv")
def export_csv(request: Request):
    require_user(request)
    with db() as conn:
        body = to_hubspot_csv(approved_rows(conn))
    return Response(body, media_type="text/csv",
                    headers={"Content-Disposition": "attachment; filename=paladin_hubspot_companies.csv"})


# JSON API (session cookie or HTTP Basic).
@app.post("/api/batches")
async def api_upload(request: Request, file: UploadFile = File(...)):
    user = require_user(request)
    try:
        with db() as conn:
            return ingest(conn, file.filename or "upload.csv", await file.read(), user)
    except ValueError as exc:
        raise HTTPException(400, str(exc))


@app.post("/api/batches/{batch_id}/run")
def api_run_batch(request: Request, batch_id: int, background: BackgroundTasks, force: bool = False):
    require_user(request)
    background.add_task(_process_batch, batch_id, force)
    return {"batch_id": batch_id, "started": True}


@app.post("/api/accounts/{account_id}/run")
def api_run_account(request: Request, account_id: int):
    """Synchronous single-account run. This is the unit a serverless deployment calls."""
    require_user(request)
    deps = make_deps(settings)
    try:
        account = deps.conn.execute("SELECT id, name, domain FROM accounts WHERE id = %s", (account_id,)).fetchone()
        if not account:
            raise HTTPException(404, "account not found")
        runner = Runner(deps)
        try:
            return jsonable(runner.start(account))
        finally:
            runner.close()
    finally:
        deps.conn.close()


@app.get("/api/runs/{run_id}")
def api_run(request: Request, run_id: str):
    require_user(request)
    with db() as conn:
        run = _load_run(conn, run_id)
        run["events"] = conn.execute("SELECT node, event, latency_ms, tokens_in, tokens_out, data, created_at"
                                     " FROM trace_events WHERE run_id = %s ORDER BY id", (run_id,)).fetchall()
    return JSONResponse(jsonable(run))


def jsonable(obj):
    import json

    return json.loads(json.dumps(obj, default=str))


@app.get("/robots.txt", response_class=PlainTextResponse)
def robots():
    return "User-agent: *\nDisallow: /\n"
