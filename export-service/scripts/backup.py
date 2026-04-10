from app.db import backup_database


def main() -> None:
    path = backup_database()
    print(f"[ok] backup created: {path}")


if __name__ == "__main__":
    main()
