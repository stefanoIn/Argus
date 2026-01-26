import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent

CSV_FILES = [
    "global_mortality_rate.csv",
    "global_potential_work_hours_lost.csv",
    "global_sleep_lost.csv",
    "vulnerable_people_expsore_days.csv",
]

DECIMAL_COMMA_COLUMNS = {
    "global_mortality_rate.csv": ["AF"],
    "global_sleep_lost.csv": ["Sleep_loss_percentage"],
}


PREFERRED_ENCODINGS = ["utf-8", "latin-1", "cp1252"]


def read_csv_with_fallbacks(csv_path: Path) -> pd.DataFrame:
    last_error: Exception | None = None
    for enc in PREFERRED_ENCODINGS:
        try:
            return pd.read_csv(csv_path, encoding=enc)
        except UnicodeDecodeError as err:
            last_error = err
    if last_error is not None:
        raise last_error
    return pd.read_csv(csv_path)


def normalize_decimal_commas(df: pd.DataFrame, columns: list[str]) -> pd.DataFrame:
    for col in columns:
        if col in df.columns:
            df[col] = (
                df[col]
                .astype(str)
                .str.replace(",", ".", regex=False)
                .replace({"nan": None, "": None})
            )
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def convert_csv_to_json(csv_path: Path) -> Path:
    df = read_csv_with_fallbacks(csv_path)

    decimal_cols = DECIMAL_COMMA_COLUMNS.get(csv_path.name, [])
    if decimal_cols:
        df = normalize_decimal_commas(df, decimal_cols)

    # Best-effort numeric coercion for other columns without breaking strings
    for col in df.columns:
        if col in decimal_cols:
            continue
        if df[col].dtype == object:
            coerced = pd.to_numeric(df[col], errors="ignore")
            df[col] = coerced

    records = df.where(pd.notnull(df), None).to_dict(orient="records")

    json_path = csv_path.with_suffix(".json")
    with json_path.open("w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)

    return json_path


def main() -> None:
    created = []
    for name in CSV_FILES:
        csv_path = ROOT / name
        if not csv_path.exists():
            continue
        created.append(convert_csv_to_json(csv_path))

    print("Created JSON files:")
    for path in created:
        print(f"- {path.name}")


if __name__ == "__main__":
    main()
