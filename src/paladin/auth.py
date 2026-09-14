"""Demo auth: one seeded operator, bcrypt hash in Postgres, signed session cookie."""

from __future__ import annotations

import bcrypt
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

COOKIE = "paladin_session"
MAX_AGE = 12 * 3600


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def check_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except ValueError:
        return False


def seed_operator(conn, username: str, password: str) -> None:
    if len(password) < 10:
        raise ValueError("operator password must be at least 10 characters")
    conn.execute(
        "INSERT INTO operators(username, password_hash) VALUES (%s, %s)"
        " ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash",
        (username, hash_password(password)),
    )


def authenticate(conn, username: str, password: str) -> bool:
    row = conn.execute("SELECT password_hash FROM operators WHERE username = %s", (username,)).fetchone()
    return bool(row) and check_password(password, row["password_hash"])


def signer(secret: str) -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(secret, salt="paladin-session")


def read_session(secret: str, token: str | None) -> str | None:
    if not token:
        return None
    try:
        return signer(secret).loads(token, max_age=MAX_AGE)
    except (BadSignature, SignatureExpired):
        return None
