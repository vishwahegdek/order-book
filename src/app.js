// src/app.js
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import morgan from "morgan";
import dotenv from "dotenv";

import ordersRouter from "./routes/orders.js";
import apiRouter from "./routes/api.js";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// view engine setup
app.set("views", path.join(__dirname, "..", "views"));
app.set("view engine", "ejs");

// middleware
app.use(morgan("dev"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// routes
app.use("/orders", ordersRouter);
app.use("/api", apiRouter);

// redirect root → orders
app.get("/", (req, res) => res.redirect("/orders"));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Order Book running at http://localhost:${port}`);
});
