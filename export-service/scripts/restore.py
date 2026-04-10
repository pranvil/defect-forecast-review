import argparse
from pathlib import Path

from app.db import get_db_path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("backup_file", type=str, help="Path to backup sqlite file")
    args = parser.parse_args()

    src = Path(args.backup_file)
    if not src.exists():
        raise SystemExit(f"backup file not found: {src}")

    dst = get_db_path()
    dst.write_bytes(src.read_bytes())
    print(f"[ok] restored database from {src} to {dst}")


if __name__ == "__main__":
    main()
