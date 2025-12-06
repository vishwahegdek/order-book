-- Database Schema for Order Book

-- 1. Customers
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- 2. Products
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT,
  default_unit_price NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
);

-- 3. Orders
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_no TEXT,
  customer_id INTEGER REFERENCES customers(id),
  order_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  delivery_date DATE,
  status TEXT DEFAULT 'confirmed',
  total_amount NUMERIC DEFAULT 0,
  advance_amount NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP WITHOUT TIME ZONE
);

-- 4. Order Items
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id),
  product_id INTEGER REFERENCES products(id),
  product_name TEXT,
  description TEXT,
  quantity NUMERIC DEFAULT 0,
  unit_price NUMERIC DEFAULT 0,
  line_total NUMERIC DEFAULT 0
);
