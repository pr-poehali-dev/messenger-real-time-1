"""
Авторизация через телефон: отправка OTP и верификация.
POST /send-otp  — отправить код на телефон
POST /verify-otp — проверить код и получить токен сессии
GET  /me        — получить данные текущего пользователя
POST /update-profile — обновить имя и username
POST /logout    — выйти из сессии
"""
import json
import os
import random
import string
import secrets
import psycopg2


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p25066548_messenger_real_time_")

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-User-Id, X-Auth-Token",
}


def resp(status, body):
    return {"statusCode": status, "headers": {**CORS, "Content-Type": "application/json"}, "body": json.dumps(body, ensure_ascii=False)}


def get_user_from_token(conn, token):
    cur = conn.cursor()
    cur.execute(
        f"SELECT u.id, u.phone, u.name, u.username, u.bio FROM {SCHEMA}.sessions s "
        f"JOIN {SCHEMA}.users u ON u.id = s.user_id "
        f"WHERE s.token = %s AND s.expires_at > NOW()",
        (token,)
    )
    row = cur.fetchone()
    if not row:
        return None
    return {"id": row[0], "phone": row[1], "name": row[2], "username": row[3], "bio": row[4]}


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

    # ── SEND OTP ──
    if path.endswith("/send-otp") and method == "POST":
        phone = (body.get("phone") or "").strip()
        if not phone or len(phone) < 10:
            return resp(400, {"error": "Укажите номер телефона"})

        # Нормализуем: оставляем только цифры и +
        phone = "+" + "".join(c for c in phone if c.isdigit())

        code = str(random.randint(100000, 999999))

        cur.execute(
            f"INSERT INTO {SCHEMA}.otp_codes (phone, code, expires_at) VALUES (%s, %s, NOW() + INTERVAL '5 minutes')",
            (phone, code)
        )
        conn.commit()

        # В реальном проекте здесь отправка SMS через провайдера
        # Пока возвращаем код в ответе для демо (убрать в продакшне)
        return resp(200, {"ok": True, "demo_code": code, "message": f"Код отправлен на {phone}"})

    # ── VERIFY OTP ──
    if path.endswith("/verify-otp") and method == "POST":
        phone = (body.get("phone") or "").strip()
        code = (body.get("code") or "").strip()
        name = (body.get("name") or "").strip()

        if not phone or not code:
            return resp(400, {"error": "Укажите телефон и код"})

        phone = "+" + "".join(c for c in phone if c.isdigit())

        cur.execute(
            f"SELECT id FROM {SCHEMA}.otp_codes WHERE phone=%s AND code=%s AND expires_at > NOW() AND used=FALSE ORDER BY id DESC LIMIT 1",
            (phone, code)
        )
        otp_row = cur.fetchone()
        if not otp_row:
            return resp(400, {"error": "Неверный или просроченный код"})

        # Помечаем код как использованный
        cur.execute(f"UPDATE {SCHEMA}.otp_codes SET used=TRUE WHERE id=%s", (otp_row[0],))

        # Получаем или создаём пользователя
        cur.execute(f"SELECT id, phone, name, username, bio FROM {SCHEMA}.users WHERE phone=%s", (phone,))
        user_row = cur.fetchone()

        if user_row:
            user_id = user_row[0]
            is_new = False
        else:
            display_name = name if name else f"Пользователь {phone[-4:]}"
            cur.execute(
                f"INSERT INTO {SCHEMA}.users (phone, name) VALUES (%s, %s) RETURNING id",
                (phone, display_name)
            )
            user_id = cur.fetchone()[0]
            is_new = True

        # Создаём токен сессии
        session_token = secrets.token_hex(32)
        cur.execute(
            f"INSERT INTO {SCHEMA}.sessions (user_id, token) VALUES (%s, %s)",
            (user_id, session_token)
        )
        conn.commit()

        cur.execute(f"SELECT id, phone, name, username, bio FROM {SCHEMA}.users WHERE id=%s", (user_id,))
        u = cur.fetchone()

        return resp(200, {
            "ok": True,
            "token": session_token,
            "is_new": is_new,
            "user": {"id": u[0], "phone": u[1], "name": u[2], "username": u[3], "bio": u[4]}
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
        username = body.get("username", user["username"])
        bio = body.get("bio", user["bio"])

        cur.execute(
            f"UPDATE {SCHEMA}.users SET name=%s, username=%s, bio=%s WHERE id=%s",
            (name, username, bio, user["id"])
        )
        conn.commit()
        return resp(200, {"ok": True})

    # ── LOGOUT ──
    if path.endswith("/logout") and method == "POST":
        if token:
            cur.execute(f"UPDATE {SCHEMA}.sessions SET expires_at=NOW() WHERE token=%s", (token,))
            conn.commit()
        return resp(200, {"ok": True})

    return resp(404, {"error": "Not found"})
