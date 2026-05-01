const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const Stripe = require("stripe");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();

// ======================
// MIDDLEWARE
// ======================
app.use(cors());
app.use(express.json());

// ======================
// CONFIG
// ======================
const JWT_SECRET = "NELSHOP_SECRET_KEY";
const stripe = Stripe("sk_test_YOUR_STRIPE_KEY");

// ======================
// TEST ROUTE
// ======================
app.get("/", (req, res) => {
  res.send("NELSHOP BACKEND ONLINE 🚀");
});

// ======================
// MONGODB
// ======================
mongoose.connect(
  "mongodb+srv://nelsontessa97_db_user:N3ryDtole1WTRggT@cluster0.klgdw4z.mongodb.net/nelshop?retryWrites=true&w=majority"
)
.then(() => console.log("🚀 MongoDB CONNECTÉ"))
.catch(err => console.log("❌ MongoDB ERROR:", err.message));

// ======================
// MODELS
// ======================
const User = mongoose.model("User", {
  name: String,
  email: String,
  password: String,
  role: { type: String, default: "user" }
});

const Product = mongoose.model("Product", {
  name: String,
  price: Number,
  image: String,
  sellerId: String
});

const Order = mongoose.model("Order", {
  userId: String,
  items: Array,
  total: Number,
  commission: Number,
  createdAt: { type: Date, default: Date.now }
});

// ======================
// AUTH MIDDLEWARE
// ======================
function auth(req, res, next) {
  const token = req.headers.authorization;

  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const decoded = jwt.verify(token.split(" ")[1], JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

// ======================
// ADMIN CHECK
// ======================
function isAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Access denied" });
  }
  next();
}

// ======================
// AUTH ROUTES
// ======================
app.post("/api/register", async (req, res) => {
  const hashedPassword = await bcrypt.hash(req.body.password, 10);

  const user = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: hashedPassword
  });

  res.json({ message: "User created" });
});

app.post("/api/login", async (req, res) => {
  const user = await User.findOne({ email: req.body.email });

  if (!user) return res.status(404).json({ error: "User not found" });

  const valid = await bcrypt.compare(req.body.password, user.password);

  if (!valid) return res.status(401).json({ error: "Wrong password" });

  const token = jwt.sign(
    { id: user._id, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.json({ token });
});

// ======================
// PRODUCTS
// ======================
app.get("/api/products", async (req, res) => {
  const products = await Product.find();
  res.json(products);
});

app.post("/api/products", auth, async (req, res) => {
  const product = await Product.create({
    ...req.body,
    sellerId: req.user.id
  });

  res.json(product);
});

// ======================
// ORDERS
// ======================
app.post("/api/order", auth, async (req, res) => {

  let total = 0;
  req.body.items.forEach(i => total += i.price);

  const commission = total * 0.1;

  const order = await Order.create({
    userId: req.user.id,
    items: req.body.items,
    total,
    commission
  });

  res.json(order);
});

// ======================
// ADMIN ROUTES
// ======================
app.get("/api/admin/orders", auth, isAdmin, async (req, res) => {
  const orders = await Order.find();
  res.json(orders);
});

// ======================
// PAYMENT
// ======================
app.post("/api/pay", async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: req.body.items.map(item => ({
        price_data: {
          currency: "usd",
          product_data: { name: item.name },
          unit_amount: item.price * 100
        },
        quantity: 1
      })),
      success_url: "http://localhost:3000/success.html",
      cancel_url: "http://localhost:3000/cancel.html"
    });

    res.json({ url: session.url });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ======================
// SERVER
// ======================
app.listen(5000, () => {
  console.log("🚀 SERVER RUNNING ON PORT 5000");
});