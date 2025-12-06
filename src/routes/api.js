// src/routes/api.js
import express from "express";
import { pool } from "../db.js";

const router = express.Router();

// GET /api/customers?query=
router.get("/customers", async (req, res) => {
  const q = (req.query.query || "").trim();
  if (!q) return res.json([]);

  try {
    const result = await pool.query(
      `SELECT id, name, phone, address
       FROM customers
       WHERE name ILIKE $1 OR phone ILIKE $1
       ORDER BY name
       LIMIT 10`,
      [`%${q}%`]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

// GET /api/products?query=
router.get("/products", async (req, res) => {
  const q = (req.query.query || "").trim();
  if (!q) return res.json([]);

  try {
    const result = await pool.query(
      `SELECT id, name, sku, default_unit_price
       FROM products
       WHERE name ILIKE $1 OR sku ILIKE $1
       ORDER BY name
       LIMIT 10`,
      [`%${q}%`]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

// CREATE ORDER: POST /api/orders
router.post("/orders", async (req, res) => {
  const {
    order_no,
    order_date,
    due_date,
    status,
    customer_id,
    customer_name,
    customer_phone,
    customer_address,
    total_amount,
    advance_amount,
    notes,
    items,
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1) customer
    let finalCustomerId = customer_id || null;
    const trimmedName = (customer_name || "").trim();

    if (!finalCustomerId && trimmedName) {
      const search = await client.query(
        `SELECT id FROM customers
         WHERE name = $1 AND (phone = $2 OR $2 IS NULL)
         LIMIT 1`,
        [trimmedName, customer_phone || null]
      );
      if (search.rows.length > 0) {
        finalCustomerId = search.rows[0].id;
      } else {
        const insert = await client.query(
          `INSERT INTO customers (name, phone, address)
           VALUES ($1, $2, $3)
           RETURNING id`,
          [trimmedName, customer_phone || null, customer_address || null]
        );
        finalCustomerId = insert.rows[0].id;
      }
    }

    // 2) order
    const orderInsert = await client.query(
      `INSERT INTO orders
       (order_no, customer_id, order_date, due_date, status,
        total_amount, advance_amount, notes, updated_at, is_deleted)
       VALUES
       ($1, $2, COALESCE($3::date, CURRENT_DATE), $4::date, $5,
        COALESCE($6, 0), COALESCE($7, 0), $8, NOW(), FALSE)
       RETURNING id`,
      [
        order_no || null,
        finalCustomerId,
        order_date || null,
        due_date || null,
        status || "confirmed",
        total_amount || 0,
        advance_amount || 0,
        notes || null,
      ]
    );

    const orderId = orderInsert.rows[0].id;

    // 3) items
    if (Array.isArray(items)) {
      for (const item of items) {
        let { product_id, name, description, quantity, unit_price } = item;
        const trimmedProductName = (name || "").trim();
        let finalProductId = product_id || null;

        if (!finalProductId && trimmedProductName) {
          const searchProd = await client.query(
            `SELECT id FROM products WHERE name = $1 LIMIT 1`,
            [trimmedProductName]
          );
          if (searchProd.rows.length > 0) {
            finalProductId = searchProd.rows[0].id;
          } else {
            const insertProd = await client.query(
              `INSERT INTO products (name, default_unit_price)
               VALUES ($1, COALESCE($2, 0))
               RETURNING id`,
              [trimmedProductName, unit_price || 0]
            );
            finalProductId = insertProd.rows[0].id;
          }
        }

        const q = Number(quantity) || 0;
        const p = Number(unit_price) || 0;
        const lineTotal = q * p;

        if (!trimmedProductName && q === 0 && p === 0 && !description) continue;

        await client.query(
          `INSERT INTO order_items
           (order_id, product_id, product_name, description,
            quantity, unit_price, line_total)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            orderId,
            finalProductId,
            trimmedProductName || null,
            description || null,
            q,
            p,
            lineTotal,
          ]
        );
      }
    }

    await client.query("COMMIT");
    res.json({ id: orderId, success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ success: false, error: "failed_to_save" });
  } finally {
    client.release();
  }
});

// UPDATE ORDER: POST /api/orders/:id
router.post("/orders/:id", async (req, res) => {
  const { id } = req.params;
  const {
    order_no,
    order_date,
    due_date,
    status,
    customer_id,
    customer_name,
    customer_phone,
    customer_address,
    total_amount,
    advance_amount,
    notes,
    items,
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1) customer (same logic as create)
    let finalCustomerId = customer_id || null;
    const trimmedName = (customer_name || "").trim();

    if (!finalCustomerId && trimmedName) {
      const search = await client.query(
        `SELECT id FROM customers
         WHERE name = $1 AND (phone = $2 OR $2 IS NULL)
         LIMIT 1`,
        [trimmedName, customer_phone || null]
      );
      if (search.rows.length > 0) {
        finalCustomerId = search.rows[0].id;
      } else {
        const insert = await client.query(
          `INSERT INTO customers (name, phone, address)
           VALUES ($1, $2, $3)
           RETURNING id`,
          [trimmedName, customer_phone || null, customer_address || null]
        );
        finalCustomerId = insert.rows[0].id;
      }
    }

    // 2) update order
    await client.query(
      `UPDATE orders
       SET order_no       = $1,
           customer_id    = $2,
           order_date     = COALESCE($3::date, order_date),
           due_date       = $4::date,
           status         = $5,
           total_amount   = COALESCE($6, 0),
           advance_amount = COALESCE($7, 0),
           notes          = $8,
           updated_at     = NOW()
       WHERE id = $9`,
      [
        order_no || null,
        finalCustomerId,
        order_date || null,
        due_date || null,
        status || "confirmed",
        total_amount || 0,
        advance_amount || 0,
        notes || null,
        id,
      ]
    );

    // 3) remove old items
    await client.query(`DELETE FROM order_items WHERE order_id = $1`, [id]);

    // 4) reinsert items
    if (Array.isArray(items)) {
      for (const item of items) {
        let { product_id, name, description, quantity, unit_price } = item;
        const trimmedProductName = (name || "").trim();
        let finalProductId = product_id || null;

        if (!finalProductId && trimmedProductName) {
          const searchProd = await client.query(
            `SELECT id FROM products WHERE name = $1 LIMIT 1`,
            [trimmedProductName]
          );
          if (searchProd.rows.length > 0) {
            finalProductId = searchProd.rows[0].id;
          } else {
            const insertProd = await client.query(
              `INSERT INTO products (name, default_unit_price)
               VALUES ($1, COALESCE($2, 0))
               RETURNING id`,
              [trimmedProductName, unit_price || 0]
            );
            finalProductId = insertProd.rows[0].id;
          }
        }

        const q = Number(quantity) || 0;
        const p = Number(unit_price) || 0;
        const lineTotal = q * p;

        if (!trimmedProductName && q === 0 && p === 0 && !description) continue;

        await client.query(
          `INSERT INTO order_items
           (order_id, product_id, product_name, description,
            quantity, unit_price, line_total)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            id,
            finalProductId,
            trimmedProductName || null,
            description || null,
            q,
            p,
            lineTotal,
          ]
        );
      }
    }

    await client.query("COMMIT");
    res.json({ id: Number(id), success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ success: false, error: "failed_to_update" });
  } finally {
    client.release();
  }
});

export default router;
