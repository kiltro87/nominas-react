"""portfolio_ingestor.py

Reads the portfolio Excel file from Google Drive and upserts the rows into
the Supabase `portfolio_transactions` table.

Usage:
    python portfolio_ingestor.py --config config.json

The config.json must include all keys required by drive_ingestor.py plus:
    portfolio_file_id: Google Drive file ID of the Excel workbook.

The Excel is expected to have at minimum these columns (case-insensitive,
extra columns are ignored):
    FILE_NAME, RELEASE_PURCHASE_TRADE_DATE, SETL_DATE, AWARD_NUMBER,
    QUANTITY, STOCK_PRICE, NET_AMOUNT, AEAT_Tipo_Operacion, AEAT_Fecha,
    AEAT_Num_Titulos, Conversion_Rate, AEAT_Importe_Euro,
    ORDERING, CUMULATIVE_QUANTITY, DUPLICATION (optional)
"""

from __future__ import annotations

import argparse
import io
import json
import math
from datetime import date
from pathlib import Path
from typing import Any

import pandas as pd
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

from nominas_app.services.supabase_client import SupabaseClient

DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]

# Map Excel column names (lower-cased) → DB column names
COLUMN_MAP: dict[str, str] = {
    "file_name": "file_name",
    "release_purchase_trade_date": "operation_date",
    "setl_date": "settlement_date",
    "award_number": "award_number",
    "quantity": "quantity",
    "stock_price": "stock_price_usd",
    "net_amount": "net_amount_usd",
    "aeat_tipo_operacion": "aeat_tipo",
    "aeat_fecha": "aeat_fecha",
    "aeat_num_titulos": "aeat_num_titulos",
    "conversion_rate": "conversion_rate",
    "aeat_importe_euro": "aeat_importe_eur",
    "ordering": "ordering",
    "cumulative_quantity": "cumulative_qty",
}


def load_config(config_path: str) -> dict[str, str]:
    cfg = json.loads(Path(config_path).read_text(encoding="utf-8"))
    if not cfg.get("portfolio_file_id"):
        raise ValueError("Falta 'portfolio_file_id' en config.json")
    required = ["credentials_path", "supabase_url", "supabase_service_role_key"]
    missing = [k for k in required if not cfg.get(k)]
    if missing:
        raise ValueError(f"Faltan claves en config: {', '.join(missing)}")
    return cfg


def build_drive_service(credentials_path: str):
    creds = Credentials.from_service_account_file(credentials_path, scopes=DRIVE_SCOPES)
    return build("drive", "v3", credentials=creds)


def download_excel(drive_service, file_id: str) -> bytes:
    """Download a binary file from Drive into memory."""
    request = drive_service.files().get_media(fileId=file_id)
    buf = io.BytesIO()
    downloader = MediaIoBaseDownload(buf, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    return buf.getvalue()


def _safe_date(val: Any) -> str | None:
    """Convert various date representations to ISO string or None."""
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return None
    if isinstance(val, (date, pd.Timestamp)):
        return pd.Timestamp(val).strftime("%Y-%m-%d")
    s = str(val).strip()
    if not s or s.lower() in ("nat", "none", "nan", ""):
        return None
    # Try dd/mm/yyyy (AEAT format)
    for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%m/%d/%Y"):
        try:
            return pd.to_datetime(s, format=fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    try:
        return pd.to_datetime(s, dayfirst=True).strftime("%Y-%m-%d")
    except Exception:  # noqa: BLE001
        return None


def _safe_numeric(val: Any) -> float | None:
    if val is None:
        return None
    if isinstance(val, float) and math.isnan(val):
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _safe_int(val: Any) -> int | None:
    n = _safe_numeric(val)
    return int(n) if n is not None else None


def parse_excel(raw: bytes) -> list[dict[str, Any]]:
    """Parse the Excel workbook and return a list of DB-ready row dicts."""
    df = pd.read_excel(io.BytesIO(raw), dtype=str)

    # Normalise column headers
    df.columns = [str(c).strip().lower() for c in df.columns]

    # Drop rows marked as duplicates (if the column exists)
    if "duplication" in df.columns:
        before = len(df)
        df = df[df["duplication"].str.upper().ne("DUPLICATE")]
        dropped = before - len(df)
        if dropped:
            print(f"  Filas duplicadas eliminadas: {dropped}")

    rows: list[dict[str, Any]] = []
    for _, raw_row in df.iterrows():
        row: dict[str, Any] = {}
        for excel_col, db_col in COLUMN_MAP.items():
            val = raw_row.get(excel_col)

            if db_col in ("operation_date", "settlement_date", "aeat_fecha"):
                row[db_col] = _safe_date(val)
            elif db_col in (
                "quantity", "stock_price_usd", "net_amount_usd",
                "aeat_num_titulos", "conversion_rate", "aeat_importe_eur", "cumulative_qty",
            ):
                row[db_col] = _safe_numeric(val)
            elif db_col == "ordering":
                row[db_col] = _safe_int(val)
            else:
                row[db_col] = str(val).strip() if val and str(val).strip() not in ("nan", "None", "") else None

        # Skip rows without the mandatory file_name
        if not row.get("file_name"):
            continue

        rows.append(row)

    return rows


def ingest_portfolio(config_path: str) -> None:
    cfg = load_config(config_path)
    schema = cfg.get("supabase_schema") or "public"
    sheets = SupabaseClient(cfg["supabase_url"], cfg["supabase_service_role_key"], schema)

    print("Conectando a Google Drive...")
    drive_service = build_drive_service(cfg["credentials_path"])

    file_id = cfg["portfolio_file_id"]
    print(f"Descargando Excel (file_id={file_id})...")
    raw = download_excel(drive_service, file_id)
    print(f"  Descargado: {len(raw):,} bytes")

    rows = parse_excel(raw)
    print(f"  Filas válidas tras parseo: {len(rows)}")

    if not rows:
        print("No hay filas para insertar. Fin.")
        return

    print(f"Haciendo upsert de {len(rows)} filas en portfolio_transactions...")
    sheets.upsert_rows("portfolio_transactions", rows, on_conflict="file_name")
    print("Upsert completado.")

    acquisitions = sum(1 for r in rows if r.get("aeat_tipo") == "AD")
    sells = sum(1 for r in rows if r.get("aeat_tipo") == "TR")
    last_row = max(rows, key=lambda r: r.get("ordering") or 0)
    print(
        f"\nResumen:\n"
        f"  Adquisiciones (AD): {acquisitions}\n"
        f"  Ventas       (TR): {sells}\n"
        f"  Acciones acumuladas (última fila): {last_row.get('cumulative_qty')}\n"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest portfolio Excel from Drive into Supabase")
    parser.add_argument("--config", default="config.json", help="Path to config.json")
    args = parser.parse_args()
    ingest_portfolio(args.config)


if __name__ == "__main__":
    main()
