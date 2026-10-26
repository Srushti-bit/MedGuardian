
from getpass import getpass

from sqlalchemy import select

from auth import SessionLocal, User, create_user, init_db


def main():
    init_db()

    with SessionLocal() as db:
        existing_admin = db.scalar(
            select(User).where(User.role == "admin")
        )
        if existing_admin:
            print("An administrator account already exists.")
            return

        username = input("Choose administrator username: ").strip()
        password = getpass("Choose administrator password (12+ characters): ")
        confirm = getpass("Confirm administrator password: ")

        if password != confirm:
            print("Passwords do not match. No account was created.")
            return

        try:
            admin = create_user(db, username, password, role="admin")
            print(f"Administrator '{admin.username}' created successfully.")
        except ValueError as exc:
            print(f"Could not create administrator: {exc}")


if __name__ == "__main__":
    main()
