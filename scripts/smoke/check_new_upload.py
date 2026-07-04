#!/usr/bin/env python3
"""
驗收②：新上傳流程在正式機可用（只測到 Blob 寫入層，跑完自動清理，零殘留）。

流程：
  1. 取得會員（或後台管理員）JWT —— 優先 --jwt / MEMBER_JWT 環境變數；
     若都沒給且提供 --login-* 參數，才嘗試腳本登入（正式環境因 reCAPTCHA v3
     後端驗證已啟用，空 token 必定被拒，此嘗試預期會失敗，僅保留作為未來
     若政策調整時的免修改備援路徑；見 README「reCAPTCHA 對本腳本的限制」）。
  2. POST {api_base}/uploads（folder=appointments，記憶體產生的 1x1 PNG）。
  3. GET 回傳的 url，確認 200 + content-type 為 image/*。
  4. 清理：呼叫 az storage blob delete 刪除剛上傳的測試 blob（帳戶金鑰 / SAS /
     az login 身分三擇一），再次 GET 確認 404 → 回報「零殘留」。
  5. 絕不呼叫 POST /api/appointments，不建立任何預約紀錄。

用法：
    # 已用瀏覽器登入拿到會員 JWT，貼進來即可（最常見路徑，見 README）
    python3 check_new_upload.py --jwt eyJhbGciOi... --account-key "$AZURE_STORAGE_KEY"

    # 用 az login 身分刪除（免帳戶金鑰，需該身分有 Storage Blob Data Contributor 角色）
    python3 check_new_upload.py --jwt "$MEMBER_JWT"

    # 嘗試腳本登入（正式環境預期失敗，僅供未來備援）
    python3 check_new_upload.py --login-number B121583140 --login-yyyy 1978 --login-mm 2 --login-dd 1

詳見 scripts/smoke/README.md。
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (  # noqa: E402
    DEFAULT_API_BASE,
    DEFAULT_CONTAINER,
    DEFAULT_STORAGE_ACCOUNT,
    DEFAULT_UPLOAD_BASE,
    die,
    encode_multipart,
    http_check,
    http_json,
    is_image_content_type,
    make_1x1_png,
)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--api-base", default=os.environ.get("API_BASE", DEFAULT_API_BASE))
    p.add_argument("--upload-base", default=os.environ.get("UPLOAD_BASE", DEFAULT_UPLOAD_BASE))
    p.add_argument("--folder", default="appointments", help="上傳目錄（預設 appointments，白名單見後端）")

    p.add_argument("--jwt", default=os.environ.get("MEMBER_JWT"), help="已取得的會員/管理員 JWT（優先使用）")
    p.add_argument("--login-number", help="嘗試腳本登入：身分證字號（預期正式環境因 reCAPTCHA 失敗）")
    p.add_argument("--login-yyyy", type=int)
    p.add_argument("--login-mm", type=int)
    p.add_argument("--login-dd", type=int)

    p.add_argument("--storage-account", default=os.environ.get("STORAGE_ACCOUNT", DEFAULT_STORAGE_ACCOUNT))
    p.add_argument("--container", default=os.environ.get("STORAGE_CONTAINER", DEFAULT_CONTAINER))
    p.add_argument("--account-key", default=os.environ.get("AZURE_STORAGE_KEY"), help="清理用帳戶金鑰")
    p.add_argument("--sas-token", default=os.environ.get("AZURE_STORAGE_SAS_TOKEN"), help="清理用 SAS token")
    p.add_argument(
        "--cleanup-auth", choices=["auto", "key", "sas", "login"], default="auto",
        help="清理認證方式：auto=依 --account-key/--sas-token 是否提供自動選擇，"
             "否則退回 login（用 az login 身分，需 Storage Blob Data Contributor 角色）",
    )
    p.add_argument("--timeout", type=int, default=15)
    return p.parse_args()


def resolve_jwt(args: argparse.Namespace) -> str:
    if args.jwt:
        return args.jwt

    if args.login_number and args.login_yyyy and args.login_mm and args.login_dd:
        print("[嘗試] 未提供 --jwt，嘗試腳本登入（正式環境因 reCAPTCHA v3 後端驗證，預期會失敗）…")
        status, body, raw, err = http_json(
            f"{args.api_base}/auth/member/login",
            method="POST",
            json_body={
                "number": args.login_number,
                "yyyy": args.login_yyyy,
                "mm": args.login_mm,
                "dd": args.login_dd,
                "googleCaptchaToken": "",
            },
            timeout=args.timeout,
        )
        if err:
            die(f"腳本登入連線失敗：{err}")
        if body and body.get("success") and body.get("data", {}).get("token"):
            print("[意外成功] 腳本登入竟然成功了（可能是 reCAPTCHA secret 未設定的環境）。")
            return body["data"]["token"]
        die(
            "腳本登入被拒（符合預期，正式環境 reCAPTCHA 需要瀏覽器產生的真實 v3 token）。\n"
            f"  回應：{raw}\n"
            "  請改用瀏覽器登入正式站，從 DevTools（Network 分頁 /api/auth/member/login 回應，"
            "或 Application 分頁 localStorage）複製 JWT，帶入 --jwt 參數或 MEMBER_JWT 環境變數。\n"
            "  詳見 README「reCAPTCHA 對本腳本的限制與手動取得 JWT 步驟」。",
            code=2,
        )

    die(
        "未提供 JWT：請用 --jwt <token> 或環境變數 MEMBER_JWT。\n"
        "  正式環境登入需通過瀏覽器的 reCAPTCHA v3，本腳本無法自動取得，"
        "請先用瀏覽器登入正式站取得 JWT 後貼入。詳見 README。",
        code=2,
    )


def upload_test_image(api_base: str, jwt: str, folder: str, timeout: int) -> dict:
    png_bytes = make_1x1_png()
    body, boundary = encode_multipart(
        fields={"folder": folder},
        files={"file": ("smoke-test.png", png_bytes, "image/png")},
    )
    return _post_multipart(f"{api_base}/uploads", jwt, body, boundary, timeout)


def _post_multipart(url: str, jwt: str, body: bytes, boundary: str, timeout: int) -> dict:
    import urllib.error
    import urllib.request

    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {jwt}",
            "Content-Type": f"multipart/form-data; boundary={boundary}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            return {"status": resp.status, "raw": raw}
    except urllib.error.HTTPError as e:
        return {"status": e.code, "raw": e.read()}
    except Exception as e:  # noqa: BLE001
        die(f"POST /api/uploads 連線失敗：{e}")


def cleanup_blob(args: argparse.Namespace, folder: str, filename: str) -> None:
    if not shutil.which("az"):
        die(
            "找不到 az CLI，無法自動清理剛上傳的測試 blob！\n"
            f"  請手動執行：az storage blob delete --account-name {args.storage_account} "
            f"--container-name {args.container} --name {folder}/{filename} --auth-mode login\n"
            "  （或加 --account-key/--sas-token）避免留下殘留檔案。",
            code=3,
        )

    cmd = [
        "az", "storage", "blob", "delete",
        "--account-name", args.storage_account,
        "--container-name", args.container,
        "--name", f"{folder}/{filename}",
    ]
    mode = args.cleanup_auth
    if mode == "auto":
        mode = "key" if args.account_key else ("sas" if args.sas_token else "login")

    if mode == "key":
        cmd += ["--account-key", args.account_key]
    elif mode == "sas":
        cmd += ["--sas-token", args.sas_token]
    else:
        cmd += ["--auth-mode", "login"]

    print(f"[清理] 刪除測試 blob {folder}/{filename}（認證方式：{mode}）…")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if result.returncode != 0:
        die(
            f"az storage blob delete 失敗，測試 blob 可能殘留！\n"
            f"  指令：{' '.join(cmd)}\n"
            f"  stderr：{result.stderr}\n"
            f"  請手動確認並刪除 {folder}/{filename}，避免正式環境殘留測試檔案。",
            code=3,
        )


def main() -> None:
    args = parse_args()
    jwt = resolve_jwt(args)

    print(f"[1/4] POST {args.api_base}/uploads（folder={args.folder}，1x1 測試 PNG）…")
    result = upload_test_image(args.api_base, jwt, args.folder, args.timeout)
    if result["status"] != 200:
        die(f"上傳失敗，HTTP {result['status']}：{result['raw'][:500]!r}")

    import json as _json

    try:
        payload = _json.loads(result["raw"])
    except Exception:
        die(f"上傳回應非 JSON：{result['raw'][:500]!r}")

    if not payload.get("success"):
        die(f"上傳回應 success=false：{payload.get('code')} {payload.get('message')}")

    data = payload.get("data") or {}
    filename, folder, url = data.get("filename"), data.get("folder"), data.get("url")
    if not (filename and folder and url):
        die(f"上傳回應缺少 filename/folder/url：{data}")
    print(f"      → 上傳成功：filename={filename}  folder={folder}\n      → url={url}")

    try:
        print(f"[2/4] GET {url} 確認可顯示…")
        check = http_check(url, timeout=args.timeout, ranged=False)
        display_ok = check.status == 200 and is_image_content_type(check.content_type)
        if check.status == 200 and not is_image_content_type(check.content_type):
            print(f"      ⚠ 200 但 content-type={check.content_type}（非 image/*）")
        elif check.status != 200:
            print(f"      ✗ 非預期狀態碼：{check.status}（error={check.error}）")
        else:
            print(f"      ✓ 200，content-type={check.content_type}")
    finally:
        # 不論顯示驗證是否通過，只要上傳成功就必須清理，避免殘留。
        print(f"[3/4] 清理剛上傳的測試 blob（絕不呼叫 /api/appointments，不建立預約）…")
        cleanup_blob(args, folder, filename)

    print(f"[4/4] 再次 GET {url} 確認已刪除（404）…")
    recheck = http_check(url, timeout=args.timeout, ranged=False)
    if recheck.status == 404:
        print("      ✓ 404，確認零殘留")
    else:
        die(
            f"清理後重新 GET 仍非 404（status={recheck.status}），"
            "可能有 CDN/瀏覽器快取延遲，或刪除實際未成功，請人工複查！",
            code=3,
        )

    if not display_ok:
        print("\n[結果] 清理已完成（零殘留），但顯示驗證未通過，請檢視上方訊息。")
        sys.exit(1)

    print("\n[結果] 驗收②通過：上傳可用、可顯示、已清理零殘留。")
    sys.exit(0)


if __name__ == "__main__":
    sys.stdout.reconfigure(line_buffering=True)
    main()
