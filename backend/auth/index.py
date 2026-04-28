"""
Prime Chat — авторизация по логину и паролю.
POST /register      — создать аккаунт (login, password, name)
POST /login         — войти (login, password) → токен сессии
GET  /me            — данные текущего пользователя
POST /update-profile — обновить имя, bio
POST /logout        — выйти из сессии
"""
import json
import os
import secrets
import hashlib
import psycopg2


SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p25066548_messenger_real_time_")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Auth-Token",
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def resp(status, body):
    return {
        "statusCode": status,
        "headers": {**CORS, "Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False),
    }


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def get_user_from_token(conn, token):
    cur = conn.cursor()
    cur.execute(
        f"SELECT u.id, u.username_login, u.name, u.bio "
        f"FROM {SCHEMA}.sessions s "
        f"JOIN {SCHEMA}.users u ON u.id = s.user_id "
        f"WHERE s.token = %s AND s.expires_at > NOW()",
        (token,),
    )
    row = cur.fetchone()
    if not row:
        return None
    return {"id": row[0], "login": row[1], "name": row[2], "bio": row[3]}


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    path = event.get("path", "/").rstrip("/")
    method = event.get("httpMethod", "GET")
    body = {}
    if event.get("body"):
        try:
            body = json.loads(event["body"])
        except Exception:
            pass

    token = (event.get("headers") or {}).get("X-Auth-Token", "")
    conn = get_conn()
    cur = conn.cursor()

    # ── REGISTER ──
    if path.endswith("/register") and method == "POST":
        login = (body.get("login") or "").strip().lower()
        password = (body.get("password") or "").strip()
        name = (body.get("name") or "").strip()

        if not login or len(login) < 3:
            return resp(400, {"error": "Логин должен быть не короче 3 символов"})
        if not password or len(password) < 6:
            return resp(400, {"error": "Пароль должен быть не короче 6 символов"})
        if not name:
            return resp(400, {"error": "Укажите ваше имя"})
        if not login.replace("_", "").replace(".", "").isalnum():
            return resp(400, {"error": "Логин может содержать только буквы, цифры, _ и ."})

        cur.execute(
            f"SELECT id FROM {SCHEMA}.users WHERE username_login = %s",
            (login,),
        )
        if cur.fetchone():
            return resp(409, {"error": "Этот логин уже занят"})

        pw_hash = hash_password(password)
        cur.execute(
            f"INSERT INTO {SCHEMA}.users (username_login, password_hash, name) "
            f"VALUES (%s, %s, %s) RETURNING id",
            (login, pw_hash, name),
        )
        user_id = cur.fetchone()[0]

        session_token = secrets.token_hex(32)
        cur.execute(
            f"INSERT INTO {SCHEMA}.sessions (user_id, token) VALUES (%s, %s)",
            (user_id, session_token),
        )
        conn.commit()

        return resp(200, {
            "ok": True,
            "token": session_token,
            "user": {"id": user_id, "login": login, "name": name, "bio": ""},
        })

    # ── LOGIN ──
    if path.endswith("/login") and method == "POST":
        login = (body.get("login") or "").strip().lower()
        password = (body.get("password") or "").strip()

        if not login or not password:
            return resp(400, {"error": "Введите логин и пароль"})

        pw_hash = hash_password(password)
        cur.execute(
            f"SELECT id, username_login, name, bio FROM {SCHEMA}.users "
            f"WHERE username_login = %s AND password_hash = %s",
            (login, pw_hash),
        )
        row = cur.fetchone()
        if not row:
            return resp(401, {"error": "Неверный логин или пароль"})

        session_token = secrets.token_hex(32)
        cur.execute(
            f"INSERT INTO {SCHEMA}.sessions (user_id, token) VALUES (%s, %s)",
            (row[0], session_token),
        )
        conn.commit()

        return resp(200, {
            "ok": True,
            "token": session_token,
            "user": {"id": row[0], "login": row[1], "name": row[2], "bio": row[3]},
        })

    # ── ME ──
    if path.endswith("/me") and method == "GET":
        if not token:
            return resp(401, {"error": "Не авторизован"})
        user = get_user_from_token(conn, token)
        if not user:
            return resp(401, {"error": "Сессия истекла"})
        return resp(200, {"user": user})

    # ── UPDATE PROFILE ──
    if path.endswith("/update-profile") and method == "POST":
        if not token:
            return resp(401, {"error": "Не авторизован"})
        user = get_user_from_token(conn, token)
        if not user:
            return resp(401, {"error": "Сессия истекла"})

        name = body.get("name", user["name"])
        bio = body.get("bio", user["bio"])
        cur.execute(
            f"UPDATE {SCHEMA}.users SET name=%s, bio=%s WHERE id=%s",
            (name, bio, user["id"]),
        )
        conn.commit()
        return resp(200, {"ok": True})

    # ── LOGOUT ──
    if path.endswith("/logout") and method == "POST":
        if token:
            cur.execute(
                f"UPDATE {SCHEMA}.sessions SET expires_at=NOW() WHERE token=%s",
                (token,),
            )
            conn.commit()
        return resp(200, {"ok": True})

    return resp(404, {"error": "Not found"})
