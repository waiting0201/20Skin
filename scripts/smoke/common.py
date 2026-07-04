"""
20Skin 正式環境 file-upload smoke-test 共用工具。

只依賴 Python 標準函式庫 + pyodbc（DB 存取無法避免，見 README「前置需求」）。
不使用 requests，HTTP 一律走 urllib，避免多一個 pip 依賴。

見 scripts/smoke/README.md、docs/blueprints/file-upload.md。
"""
from __future__ import annotations

import json
import struct
import subprocess
import sys
import urllib.error
import urllib.request
import uuid
import zlib
from dataclasses import dataclass
from typing import Optional

# ---- 已知事實（與 docs/design/infrastructure.md、web-*/environment.prod.ts 一致） ----
DEFAULT_UPLOAD_BASE = "https://st20skinprod.blob.core.windows.net/upload"
DEFAULT_API_BASE = "https://func-20skin-api-prod.azurewebsites.net/api"
DEFAULT_STORAGE_ACCOUNT = "st20skinprod"
DEFAULT_CONTAINER = "upload"
DEFAULT_SQL_SERVER = "weyprous.database.windows.net"
DEFAULT_SQL_DATABASE = "20Skin"

# folder -> (table, column)：容器子路徑 1:1 對應舊 ~/Upload 資料夾名，
# 檔名只存在對應資料表欄位（DB 從不存完整路徑/URL）。見 file-upload.md。
FOLDER_MAP = {
    "categorys": ("Categorys", "Photo"),
    "branchs": ("Branchs", "Photo"),
    "appointments": ("Appointments", "Photo"),
    "memberquestions": ("MemberQuestions", "Filename"),
}

DEFAULT_TIMEOUT = 15


# ------------------------------------------------------------------
# DB 連線（唯讀）：支援 Managed Identity access token 與 SQL 帳密 fallback，
# 沿用 infrastructure.md 記錄過、已在本專案驗證成功的 pyodbc + az access token 模式。
# ------------------------------------------------------------------

SQL_COPT_SS_ACCESS_TOKEN = 1256


def get_db_connection(
    server: str,
    database: str,
    auth: str,
    user: Optional[str] = None,
    password: Optional[str] = None,
    driver: str = "ODBC Driver 18 for SQL Server",
):
    """建立唯讀查詢用連線。auth: 'managed-identity' 或 'sql'。"""
    try:
        import pyodbc
    except ImportError:
        die(
            "缺少 pyodbc（見 scripts/smoke/README.md 前置需求：\n"
            "  pip install -r scripts/smoke/requirements.txt\n"
            "  且系統需先裝 ODBC Driver 18 for SQL Server）"
        )

    if auth == "managed-identity":
        token = _get_access_token_via_az_cli()
        token_bytes = token.encode("utf-16-le")
        token_struct = struct.pack(f"<I{len(token_bytes)}s", len(token_bytes), token_bytes)
        conn_str = (
            f"DRIVER={{{driver}}};SERVER={server},1433;DATABASE={database};"
            "Encrypt=yes;TrustServerCertificate=no;Connection Timeout=30;"
        )
        return pyodbc.connect(conn_str, attrs_before={SQL_COPT_SS_ACCESS_TOKEN: token_struct})

    if auth == "sql":
        if not user or not password:
            die(
                "--auth sql 需要 --sql-user/--sql-password 或環境變數 "
                "SQL_USER/SQL_PASSWORD"
            )
        conn_str = (
            f"DRIVER={{{driver}}};SERVER={server},1433;DATABASE={database};"
            f"UID={user};PWD={password};Encrypt=yes;TrustServerCertificate=no;"
            "Connection Timeout=30;"
        )
        return pyodbc.connect(conn_str)

    die(f"未知的 --auth 值：{auth}（僅接受 managed-identity / sql）")


def _get_access_token_via_az_cli() -> str:
    try:
        out = subprocess.run(
            [
                "az", "account", "get-access-token",
                "--resource", "https://database.windows.net",
                "--query", "accessToken", "-o", "tsv",
            ],
            capture_output=True, text=True, check=True, timeout=30,
        )
    except FileNotFoundError:
        die("找不到 az CLI，請先安裝並執行 az login（或改用 --auth sql）")
    except subprocess.CalledProcessError as e:
        die(f"az account get-access-token 失敗，請先 az login：\n{e.stderr}")
    token = out.stdout.strip()
    if not token:
        die("az account get-access-token 回傳空字串，請確認已 az login 且有權限")
    return token


# ------------------------------------------------------------------
# HTTP（純標準函式庫，不用 requests）
# ------------------------------------------------------------------

@dataclass
class HttpResult:
    status: Optional[int]
    content_type: Optional[str]
    body: bytes
    error: Optional[str]  # 例外訊息（DNS/timeout 等，非 HTTP 狀態碼）


def http_check(url: str, timeout: int = DEFAULT_TIMEOUT, ranged: bool = True) -> HttpResult:
    """輕量存活檢查：預設帶 Range 只抓開頭幾個 byte，省流量。"""
    headers = {"User-Agent": "20skin-smoke-test/1.0"}
    if ranged:
        headers["Range"] = "bytes=0-1023"
    req = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read(1024)
            return HttpResult(resp.status, resp.headers.get("Content-Type"), body, None)
    except urllib.error.HTTPError as e:
        return HttpResult(e.code, e.headers.get("Content-Type") if e.headers else None, b"", None)
    except Exception as e:  # noqa: BLE001 — 記錄任何網路層錯誤（DNS/timeout/連線拒絕）
        return HttpResult(None, None, b"", str(e))


def http_json(
    url: str,
    method: str = "GET",
    headers: Optional[dict] = None,
    json_body: Optional[dict] = None,
    timeout: int = DEFAULT_TIMEOUT,
):
    """回傳 (status, parsed_json_or_none, raw_text, error)。"""
    headers = dict(headers or {})
    data = None
    if json_body is not None:
        data = json.dumps(json_body).encode("utf-8")
        headers.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            return resp.status, _try_json(raw), raw.decode("utf-8", "replace"), None
    except urllib.error.HTTPError as e:
        raw = e.read()
        return e.code, _try_json(raw), raw.decode("utf-8", "replace"), None
    except Exception as e:  # noqa: BLE001
        return None, None, None, str(e)


def _try_json(raw: bytes):
    try:
        return json.loads(raw.decode("utf-8"))
    except Exception:
        return None


def encode_multipart(fields: dict, files: dict) -> tuple[bytes, str]:
    """組 multipart/form-data body。files: {name: (filename, content_bytes, content_type)}"""
    boundary = uuid.uuid4().hex
    parts = []
    for name, value in fields.items():
        parts.append(f"--{boundary}".encode())
        parts.append(f'Content-Disposition: form-data; name="{name}"'.encode())
        parts.append(b"")
        parts.append(str(value).encode("utf-8"))
    for name, (filename, content, content_type) in files.items():
        parts.append(f"--{boundary}".encode())
        parts.append(
            f'Content-Disposition: form-data; name="{name}"; filename="{filename}"'.encode()
        )
        parts.append(f"Content-Type: {content_type}".encode())
        parts.append(b"")
        parts.append(content)
    parts.append(f"--{boundary}--".encode())
    parts.append(b"")
    body = b"\r\n".join(parts)
    return body, boundary


def make_1x1_png() -> bytes:
    """純標準函式庫產生一張合法的 1x1 紅色 PNG（不依賴 Pillow）。"""

    def chunk(tag: bytes, payload: bytes) -> bytes:
        return (
            struct.pack(">I", len(payload))
            + tag
            + payload
            + struct.pack(">I", zlib.crc32(tag + payload) & 0xFFFFFFFF)
        )

    ihdr = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)  # 1x1, 8-bit, truecolor
    raw_scanline = b"\x00" + bytes([255, 0, 0])  # filter=0 + 1 個 RGB 像素（紅）
    idat = zlib.compress(raw_scanline)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


def die(message: str, code: int = 2) -> None:
    sys.stdout.flush()
    print(f"[錯誤] {message}", file=sys.stderr, flush=True)
    sys.exit(code)


def is_image_content_type(content_type: Optional[str]) -> bool:
    return bool(content_type) and content_type.split(";")[0].strip().lower().startswith("image/")
