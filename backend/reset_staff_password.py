
from getpass import getpass
from sqlalchemy import select

from auth import SessionLocal, User, password_hash


def main():
    username = input("Enter the exact staff username: ").strip()

    new_password = getpass("Enter new password (12+ characters): ")
    confirm_password = getpass("Confirm new password: ")

    if new_password != confirm_password:
        print("Passwords do not match. Password was not changed.")
        return

    if len(new_password) < 12:
        print("Password must contain at least 12 characters.")
        return

    with SessionLocal() as db:
        staff = db.scalar(
            select(User).where(
                User.username == username,
                User.role == "staff",
            )
        )

        if staff is None:
            print("Staff account not found. Check the exact username.")
            return

        staff.password_hash = password_hash.hash(new_password)
        db.commit()

    print("Staff password changed successfully.")


if __name__ == "__main__":
    main()
