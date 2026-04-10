from app.db import get_db_path, migrate
from app.logic import ensure_seed_data


def main() -> None:
    migrate()
    ensure_seed_data()
    print(f"[ok] migrated database: {get_db_path()}")


if __name__ == "__main__":
    main()
