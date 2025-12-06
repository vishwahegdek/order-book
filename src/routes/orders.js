// src/routes/orders.js
import express from "express";
import { pool } from "../db.js";

const router = express.Router();

// LIST: GET /orders
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         o.id,
         o.order_no,
         o.status,
         o.total_amount,
         o.advance_amount,
         o.due_date,
         o.created_at,
         c.name    AS customer_name,
         c.address AS customer_address,
         COALESCE(
           string_agg(
             CASE
               WHEN oi.product_name IS NOT NULL AND oi.product_name <> ''
               THEN oi.product_name
               ELSE 'Item'
             END,
             ', ' ORDER BY oi.id
           ),
           ''
         ) AS items_summary
       FROM orders o
       LEFT JOIN customers c    ON o.customer_id = c.id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.is_deleted = FALSE
       GROUP BY
         o.id,
         o.order_no,
         o.status,
         o.total_amount,
         o.advance_amount,
         o.due_date,
         o.created_at,
         c.name,
         c.address
       ORDER BY o.created_at DESC
       LIMIT 100`
    );

    res.render("orders-list", { orders: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading orders");
  }
});

// NEW: GET /orders/new
router.get("/new", (req, res) => {
  res.render("order-form", { order: null });
});

// EDIT: GET /orders/:id/edit
router.get("/:id/edit", async (req, res) => {
  const { id } = req.params;
  try {
    const orderRes = await pool.query(
      `SELECT
         o.*,
         c.name    AS customer_name,
         c.phone   AS customer_phone,
         c.address AS customer_address
       FROM orders o
       LEFT JOIN customers c ON o.customer_id = c.id
       WHERE o.id = $1 AND o.is_deleted = FALSE`,
      [id]
    );

    if (orderRes.rows.length === 0) {
      return res.status(404).send("Order not found");
    }

    const itemsRes = await pool.query(
      `SELECT id, product_id, product_name, description, quantity, unit_price
       FROM order_items
       WHERE order_id = $1
       ORDER BY id`,
      [id]
    );

    const order = orderRes.rows[0];
    order.items = itemsRes.rows;

    res.render("order-form", { order });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading order");
  }
});

// SOFT DELETE: POST /orders/:id/delete
router.post("/:id/delete", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(
      `UPDATE orders
       SET is_deleted = TRUE,
           deleted_at = NOW()
       WHERE id = $1`,
      [id]
    );
    res.redirect("/orders");
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to delete order");
  }
});

export default router;
