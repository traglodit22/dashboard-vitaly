#!/usr/bin/env python3
"""
Firestore JSON → PostgreSQL migration script.
Generates scripts/migration.sql and executes it on the remote server via paramiko.
"""

import json
import uuid
import os

# ── paths ────────────────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
EXPORT_DIR = os.path.join(BASE_DIR, "firestore-export")
SQL_FILE   = os.path.join(BASE_DIR, "migration.sql")


# ── helpers ──────────────────────────────────────────────────────────────────
def to_uuid(firestore_id: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, firestore_id))


def esc(val) -> str:
    """Return SQL literal: NULL or a properly-escaped string."""
    if val is None:
        return "NULL"
    return "'" + str(val).replace("'", "''") + "'"


def num(val) -> str:
    if val is None:
        return "NULL"
    return str(val)


def boolean(val) -> str:
    if val is None:
        return "NULL"
    return "TRUE" if val else "FALSE"


# ── load data ─────────────────────────────────────────────────────────────────
with open(os.path.join(EXPORT_DIR, "recipients.json"),   encoding="utf-8") as f:
    recipients = json.load(f)

with open(os.path.join(EXPORT_DIR, "employees.json"),    encoding="utf-8") as f:
    employees = json.load(f)

with open(os.path.join(EXPORT_DIR, "orders.json"),       encoding="utf-8") as f:
    orders = json.load(f)

with open(os.path.join(EXPORT_DIR, "salary_records.json"), encoding="utf-8") as f:
    salary_records = json.load(f)

print(f"Loaded: {len(recipients)} recipients, {len(employees)} employees, "
      f"{len(orders)} orders, {len(salary_records)} salary_records")


# ── build id maps ─────────────────────────────────────────────────────────────
recipient_id_map = {r["id"]: to_uuid(r["id"]) for r in recipients}
employee_id_map  = {e["id"]: to_uuid(e["id"]) for e in employees}


# ── generate SQL ──────────────────────────────────────────────────────────────
lines = []
lines.append("-- Auto-generated Firestore → PostgreSQL migration")
lines.append("-- Idempotent: ON CONFLICT (id) DO NOTHING\n")

# ── system_settings column ────────────────────────────────────────────────────
lines.append("-- Add admin_password_hash column if missing")
lines.append("ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS admin_password_hash TEXT;\n")

# ── recipients ────────────────────────────────────────────────────────────────
lines.append("-- recipients")
for r in recipients:
    new_id = recipient_id_map[r["id"]]
    cols = (
        "id, family_name, name, middle_name, passport_serial, passport_number, "
        "passport_issue_date, birth_date, inn, full_address, city, state, "
        "zip_code, phone_number, email, created_at"
    )
    vals = ", ".join([
        esc(new_id),
        esc(r.get("familyName")),
        esc(r.get("name")),
        esc(r.get("middleName")),
        esc(r.get("passportSerial")),
        esc(r.get("passportNumber")),
        esc(r.get("passportIssueDate")),
        esc(r.get("birthDate")),
        esc(r.get("inn")),
        esc(r.get("fullAddress")),
        esc(r.get("city")),
        esc(r.get("state")),
        esc(r.get("zipCode")),
        esc(r.get("phoneNumber")),
        esc(r.get("email")),
        esc(r.get("createdAt")),
    ])
    lines.append(f"INSERT INTO recipients ({cols}) VALUES ({vals}) ON CONFLICT (id) DO NOTHING;")

lines.append("")

# ── employees ─────────────────────────────────────────────────────────────────
lines.append("-- employees")
for e in employees:
    new_id = employee_id_map[e["id"]]
    cols = "id, name, role, hourly_rate, tracker_email, telegram_id, active, created_at"
    vals = ", ".join([
        esc(new_id),
        esc(e.get("name")),
        esc(e.get("role")),
        num(e.get("hourlyRate")),
        esc(e.get("trackerEmail")),
        esc(e.get("telegramId")),
        boolean(e.get("active")),
        esc(e.get("createdAt")),
    ])
    lines.append(f"INSERT INTO employees ({cols}) VALUES ({vals}) ON CONFLICT (id) DO NOTHING;")

lines.append("")

# ── orders ────────────────────────────────────────────────────────────────────
lines.append("-- orders")
for o in orders:
    new_id    = to_uuid(o["id"])
    old_rec   = o.get("recipientId")
    new_rec   = esc(recipient_id_map[old_rec]) if old_rec and old_rec in recipient_id_map else "NULL"

    cols = (
        "id, item_description, number_of_item_pieces, item_price, item_store_link, "
        "store, incoming_declaration, total_amount, status, recipient_id, "
        "dp_shipment_id, dp_track_number, dp_status_id, dp_status_name, "
        "dp_weight_kg, last_error, created_at, updated_at"
    )
    vals = ", ".join([
        esc(new_id),
        esc(o.get("itemDescription")),
        num(o.get("numberOfItemPieces")),
        num(o.get("itemPrice")),
        esc(o.get("itemStoreLink")),
        esc(o.get("store")),
        esc(o.get("incomingDeclaration")),
        num(o.get("totalAmount")),
        esc(o.get("status")),
        new_rec,
        num(o.get("dpShipmentId")),
        esc(o.get("dpTrackNumber")),
        num(o.get("dpStatusId")),
        esc(o.get("dpStatusName")),
        num(o.get("dpWeightKg")),
        esc(o.get("lastError")),
        esc(o.get("createdAt")),
        esc(o.get("updatedAt")),
    ])
    lines.append(f"INSERT INTO orders ({cols}) VALUES ({vals}) ON CONFLICT (id) DO NOTHING;")

lines.append("")

# ── salary_records ────────────────────────────────────────────────────────────
lines.append("-- salary_records")
for s in salary_records:
    old_id    = s["id"]                          # e.g. "2026-05_0Av8hKpmtBaYCytz1PCk"
    old_emp   = s.get("employeeId", "")
    new_emp   = employee_id_map.get(old_emp, to_uuid(old_emp))

    # rebuild the composite ID with the new employee UUID
    if "_" in old_id:
        prefix, _ = old_id.split("_", 1)        # "2026-05"
        new_id = f"{prefix}_{new_emp}"
    else:
        new_id = old_id

    cols = (
        "id, employee_id, month, hours, hourly_rate, bonuses, deductions, "
        "total, paid, paid_at, updated_at"
    )
    vals = ", ".join([
        esc(new_id),
        esc(new_emp),
        esc(s.get("month")),
        num(s.get("hours")),
        num(s.get("hourlyRate")),
        num(s.get("bonuses")),
        num(s.get("deductions")),
        num(s.get("total")),
        boolean(s.get("paid")),
        esc(s.get("paidAt")),
        esc(s.get("updatedAt")),
    ])
    lines.append(f"INSERT INTO salary_records ({cols}) VALUES ({vals}) ON CONFLICT (id) DO NOTHING;")

lines.append("")

sql_content = "\n".join(lines)

with open(SQL_FILE, "w", encoding="utf-8") as f:
    f.write(sql_content)

print(f"SQL file written: {SQL_FILE}")
print(f"  Recipients INSERTs : {len(recipients)}")
print(f"  Employees INSERTs  : {len(employees)}")
print(f"  Orders INSERTs     : {len(orders)}")
print(f"  Salary rec INSERTs : {len(salary_records)}")


# ── upload and execute via paramiko ──────────────────────────────────────────
import paramiko

HOST = os.environ.get("DEPLOY_SSH_HOST")
USER = os.environ.get("DEPLOY_SSH_USER", "root")
PASSWORD = os.environ.get("DEPLOY_SSH_PASSWORD")
KEY_PATH = os.environ.get("DEPLOY_SSH_KEY_PATH")
REMOTE = "/tmp/migration.sql"

if not HOST:
    print("DEPLOY_SSH_HOST not set — SQL file only, skipping remote execution.")
    raise SystemExit(0)

print(f"\nConnecting to {HOST} …")

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
connect_kwargs: dict = {"hostname": HOST, "username": USER, "timeout": 30}
if KEY_PATH:
    connect_kwargs["key_filename"] = KEY_PATH
elif PASSWORD:
    connect_kwargs["password"] = PASSWORD
else:
    print("Set DEPLOY_SSH_PASSWORD or DEPLOY_SSH_KEY_PATH")
    raise SystemExit(1)

client.connect(**connect_kwargs)
print("Connected.")

# upload
sftp = client.open_sftp()
sftp.put(SQL_FILE, REMOTE)
sftp.close()
print(f"Uploaded migration.sql → {REMOTE}")

# execute
cmd = f"sudo -u postgres psql -d dashboard_db -f {REMOTE} 2>&1"
print(f"Running: {cmd}\n")
_, stdout, stderr = client.exec_command(cmd)
output = stdout.read().decode("utf-8", errors="replace")
err    = stderr.read().decode("utf-8", errors="replace")
print(output)
if err:
    print("STDERR:", err)

client.close()
print("Done.")
