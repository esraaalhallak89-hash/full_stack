"""تحديد كمية منتج بالمستودع:  python set_stock.py <product_id> <quantity>"""
import sys

import db

if len(sys.argv) != 3:
    sys.exit("usage: python set_stock.py <product_id> <quantity>")

product_id, quantity = int(sys.argv[1]), int(sys.argv[2])
if quantity < 0:
    sys.exit("quantity must be >= 0")

conn = db.connect()
with conn, conn.cursor() as cur:
    cur.execute(
        "INSERT INTO stock (product_id, available) VALUES (%s, %s) "
        "ON DUPLICATE KEY UPDATE available = VALUES(available)",
        (product_id, quantity),
    )
    conn.commit()
print(f"product {product_id}: available = {quantity}")