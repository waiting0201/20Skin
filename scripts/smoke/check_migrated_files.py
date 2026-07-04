#!/usr/bin/env python3
"""
驗收①：舊系統歷史檔案搬遷後可顯示（唯讀，無任何清理需求）。

從正式 DB 各抽樣 N 筆非空的 Categorys.Photo / Branchs.Photo / Appointments.Photo /
MemberQuestions.Filename，組出 Blob URL 後發 HTTP 存活檢查，回報每個 folder 的
200 比例、404 破圖清單、非 image content-type 警告。

全程唯讀：只執行 SELECT，不寫入、不刪除任何 DB 或 Blob 資料。

用法：
    python3 check_migrated_files.py --auth managed-identity
    python3 check_migrated_files.py --auth sql --sql-user svc_readonly --sql-password ***
    python3 check_migrated_files.py --sample-size 50 --folders categorys,branchs
    python3 check_migrated_files.py --output report.json

詳見 scripts/smoke/README.md。
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass, field

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import (  # noqa: E402
    DEFAULT_SQL_DATABASE,
    DEFAULT_SQL_SERVER,
    DEFAULT_UPLOAD_BASE,
    FOLDER_MAP,
    get_db_connection,
    http_check,
    is_image_content_type,
)


@dataclass
class FolderReport:
    folder: str
    table: str
    column: str
    sampled: int = 0
    ok: int = 0
    broken: list = field(default_factory=list)  # [{filename, url, status}]
    non_image: list = field(default_factory=list)  # [{filename, url, content_type}]
    network_errors: list = field(default_factory=list)  # [{filename, url, error}]


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--sample-size", type=int, default=20, help="每個 folder 抽樣筆數（預設 20）")
    p.add_argument(
        "--folders", default=",".join(FOLDER_MAP.keys()),
        help=f"要檢查的 folder，逗號分隔（預設全部：{','.join(FOLDER_MAP.keys())}）",
    )
    p.add_argument("--upload-base", default=os.environ.get("UPLOAD_BASE", DEFAULT_UPLOAD_BASE))
    p.add_argument("--sql-server", default=os.environ.get("SQL_SERVER", DEFAULT_SQL_SERVER))
    p.add_argument("--sql-database", default=os.environ.get("SQL_DATABASE", DEFAULT_SQL_DATABASE))
    p.add_argument(
        "--auth", choices=["managed-identity", "sql"],
        default=os.environ.get("SQL_AUTH_MODE", "managed-identity"),
        help="DB 認證方式：managed-identity（az login 取 AAD token，預設）或 sql（帳密）",
    )
    p.add_argument("--sql-user", default=os.environ.get("SQL_USER"))
    p.add_argument("--sql-password", default=os.environ.get("SQL_PASSWORD"))
    p.add_argument("--timeout", type=int, default=15, help="每個 HTTP 檢查的逾時秒數（預設 15）")
    p.add_argument("--output", help="額外把完整報告寫成 JSON 檔（選填）")
    return p.parse_args()


def sample_filenames(conn, table: str, column: str, n: int) -> list[str]:
    """唯讀抽樣：TOP N 非空值，隨機排序。不寫入任何資料。"""
    sql = (
        f"SELECT TOP (?) [{column}] FROM [{table}] "
        f"WHERE [{column}] IS NOT NULL AND [{column}] <> '' "
        "ORDER BY NEWID()"
    )
    cur = conn.cursor()
    cur.execute(sql, n)
    return [row[0] for row in cur.fetchall()]


def check_folder(upload_base: str, folder: str, table: str, column: str, filenames: list[str], timeout: int) -> FolderReport:
    report = FolderReport(folder=folder, table=table, column=column, sampled=len(filenames))
    for filename in filenames:
        url = f"{upload_base}/{folder}/{filename}"
        result = http_check(url, timeout=timeout)
        if result.error:
            report.network_errors.append({"filename": filename, "url": url, "error": result.error})
            continue
        if result.status in (200, 206):
            report.ok += 1
            if not is_image_content_type(result.content_type):
                report.non_image.append(
                    {"filename": filename, "url": url, "content_type": result.content_type}
                )
        else:
            report.broken.append({"filename": filename, "url": url, "status": result.status})
    return report


def print_report(reports: list[FolderReport]) -> None:
    print("=" * 72)
    print("驗收① 搬遷檔可顯示 — 結果摘要")
    print("=" * 72)
    total_sampled = total_ok = total_broken = 0
    for r in reports:
        total_sampled += r.sampled
        total_ok += r.ok
        total_broken += len(r.broken)
        pct = (r.ok / r.sampled * 100) if r.sampled else 0.0
        print(f"\n[{r.folder}]（{r.table}.{r.column}）抽樣 {r.sampled} 筆 → 200/206 OK {r.ok} 筆（{pct:.1f}%）")
        if r.sampled == 0:
            print("  ⚠ 此 folder 在 DB 查無非空檔名可抽樣（可能該資料表尚無資料，非破圖問題）")
        if r.broken:
            print(f"  ✗ 404/異常破圖清單（{len(r.broken)} 筆）：")
            for b in r.broken:
                print(f"      status={b['status']}  {b['filename']}  →  {b['url']}")
        if r.non_image:
            print(f"  ⚠ 非 image content-type 警告（{len(r.non_image)} 筆）：")
            for w in r.non_image:
                print(f"      content-type={w['content_type']}  {w['filename']}  →  {w['url']}")
        if r.network_errors:
            print(f"  ⚠ 網路層錯誤（非 HTTP 狀態碼，{len(r.network_errors)} 筆，需人工複查）：")
            for e in r.network_errors:
                print(f"      {e['error']}  {e['filename']}  →  {e['url']}")

    print("\n" + "-" * 72)
    print(f"總計：抽樣 {total_sampled} 筆，200/206 OK {total_ok} 筆，破圖 {total_broken} 筆")
    print("-" * 72)


def main() -> None:
    args = parse_args()
    folders = [f.strip() for f in args.folders.split(",") if f.strip()]
    for f in folders:
        if f not in FOLDER_MAP:
            print(f"[錯誤] 未知 folder：{f}（允許：{','.join(FOLDER_MAP.keys())}）", file=sys.stderr)
            sys.exit(2)

    print(f"連線 DB：{args.sql_server}/{args.sql_database}（auth={args.auth}）")
    conn = get_db_connection(
        args.sql_server, args.sql_database, args.auth, args.sql_user, args.sql_password
    )

    reports: list[FolderReport] = []
    try:
        for folder in folders:
            table, column = FOLDER_MAP[folder]
            filenames = sample_filenames(conn, table, column, args.sample_size)
            reports.append(
                check_folder(args.upload_base, folder, table, column, filenames, args.timeout)
            )
    finally:
        conn.close()

    print_report(reports)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as fh:
            json.dump([r.__dict__ for r in reports], fh, ensure_ascii=False, indent=2)
        print(f"\n完整報告已寫入：{args.output}")

    any_broken = any(r.broken for r in reports)
    any_network_error = any(r.network_errors for r in reports)
    if any_broken:
        sys.exit(1)  # 有破圖：CI/自動化可用此 exit code 判斷失敗
    if any_network_error:
        sys.exit(3)  # 純網路層問題（可能是暫時性），與「真的破圖」分開回報
    sys.exit(0)


if __name__ == "__main__":
    sys.stdout.reconfigure(line_buffering=True)
    main()
