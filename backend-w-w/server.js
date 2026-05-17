// server.js - Hardened backend for Wheels & Walls Marketplace
// Auth: email/password (POST /api/login, /api/register) + Google OAuth.
// Facebook removed. Client SECRET lives ONLY here, NEVER in walls.js.

require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const cors = require('cors');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');

// ---------- Environment ----------
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PROD = NODE_ENV === 'production';
const PORT = parseInt(process.env.PORT || '4000', 10);

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/wheels-walls';
const JWT_SECRET = process.env.JWT_SECRET || (IS_PROD ? null : 'wheels-walls-jwt-dev-only');
const SESSION_SECRET = process.env.SESSION_SECRET || (IS_PROD ? null : 'wheels-walls-session-dev-only');

if (IS_PROD && (!JWT_SECRET || !SESSION_SECRET)) {
  console.error('FATAL: JWT_SECRET and SESSION_SECRET must be set in production.');
  process.exit(1);
}

// ---------- Filesystem ----------
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// ---------- App ----------
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

// ---------- Mongo connection (await + retry) ----------
mongoose.set('strictQuery', true);

async function connectDb() {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
      maxPoolSize: 50,
      minPoolSize: 5,
      autoIndex: !IS_PROD,
    });
    console.log('✅ Mongo connected');
    //await ensureIndexes();
  } catch (err) {
    console.error('❌ Mongo connection failed:', err.message);
    setTimeout(connectDb, 5000);
  }
}
mongoose.connection.on('disconnected', () => console.warn('⚠️  Mongo disconnected'));
mongoose.connection.on('error', (e) => console.error('Mongo error:', e.message));

// ---------- Schemas ----------
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: {
    type: String, required: true, unique: true, lowercase: true, trim: true,
    index: true, maxlength: 255,
  },
  passwordHash: { type: String, default: null }, // null for OAuth-only accounts
  phone: { type: String, trim: true, maxlength: 40 },
  phoneCode: { type: String, default: '+263', maxlength: 8 },
  phoneAlt: { type: String, trim: true, maxlength: 40 },
  phoneAltCode: { type: String, default: '+263', maxlength: 8 },
  profilePicture: { type: String, default: '' },
  isAdmin: { type: Boolean, default: false, index: true },
  isBlocked: { type: Boolean, default: false },
  googleId: { type: String, default: null, index: true, sparse: true },
  oauthProvider: { type: String, default: null },
  lastLogin: { type: Date, default: null },
  loginCount: { type: Number, default: 0 },
}, { timestamps: true });

UserSchema.methods.toJSON = function () {
  const o = this.toObject();
  delete o.passwordHash;
  return o;
};

const ListingSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 200, index: 'text' },
  description: { type: String, default: '', maxlength: 5000 },
  price: { type: Number, default: 0, index: true },
  priceLabel: { type: String, default: '' },
  location: { type: String, default: '', index: true, maxlength: 200 },
  category: String,
  categoryKey: { type: String, index: true },
  categoryLabel: String,
  topCategory: { type: String, index: true },
  condition: { type: String, index: true },
  jobType: { type: String, index: true },
  age: Number,
  yearsExperience: Number,
  englishRating: String,
  referencePhone: String,
  serviceTypes: [String],
  features: [String],
  luxuryFeatures: [String],
  school: {
    types: [String], fees: Object, levels: [String],
    curriculum: String, subjects: [String], extracurriculars: [String],
  },
  images: [String],
  contact: { name: String, email: String, phone: String, phone2: String },
  gpsCoordinates: String,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  createdByEmail: { type: String, default: '', index: true },
  clientId: { type: String, default: '', index: true, sparse: true },
  isActive: { type: Boolean, default: true, index: true },
  likes: { type: Number, default: 0 },
  views: { type: Number, default: 0 },
  enquiries: { type: Number, default: 0 },
}, { timestamps: true });

ListingSchema.index({ isActive: 1, createdAt: -1 });
ListingSchema.index({ isActive: 1, categoryKey: 1, createdAt: -1 });
ListingSchema.index({ isActive: 1, location: 1, createdAt: -1 });
ListingSchema.index({ title: 'text', description: 'text', location: 'text' });

const LikeSchema = new mongoose.Schema({
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
LikeSchema.index({ listingId: 1, userId: 1 }, { unique: true });

const EnquirySchema = new mongoose.Schema({
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  notes: String,
  contactedAt: { type: Date, default: Date.now },
}, { timestamps: true });
EnquirySchema.index({ userId: 1, contactedAt: -1 });

const User = mongoose.model('User', UserSchema);
const Listing = mongoose.model('Listing', ListingSchema);
const Like = mongoose.model('Like', LikeSchema);
const Enquiry = mongoose.model('Enquiry', EnquirySchema);

async function ensureIndexes() {
  if (IS_PROD) {
    await Promise.all([
      User.syncIndexes(), Listing.syncIndexes(),
      Like.syncIndexes(), Enquiry.syncIndexes(),
    ]);
    console.log('✅ Indexes ensured');
  }
}

// ---------- Security & perf middleware ----------
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(compression());
app.use(mongoSanitize());

// CORS allowlist (comma-separated CORS_ORIGINS env var)
const allowlist = (process.env.CORS_ORIGINS ||
  'http://localhost:3000,http://localhost:5500,http://127.0.0.1:5500')
  .split(',').map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowlist.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS: ' + origin));
  },
  credentials: true,
}));

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: IS_PROD,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
  },
}));
app.use(passport.initialize());
app.use(passport.session());

// Rate limiters
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many auth attempts, try again later.' },
});
const writeLimiter = rateLimit({
  windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false,
});
app.use('/api/', generalLimiter);

// ---------- Passport (Google only) ----------
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try { done(null, await User.findById(id)); } catch (e) { done(e); }
});

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || `http://localhost:${PORT}/api/auth/google/callback`,
    scope: ['profile', 'email'],
  }, async (_at, _rt, profile, done) => {
    try {
      const email = (profile.emails && profile.emails[0] && profile.emails[0].value || '').toLowerCase();
      let user = await User.findOne({ googleId: profile.id });
      if (!user && email) user = await User.findOne({ email });
      if (!user) {
        user = await User.create({
          name: profile.displayName,
          email: email || `${profile.id}@google.local`,
          googleId: profile.id,
          oauthProvider: 'google',
          profilePicture: profile.photos?.[0]?.value || '',
        });
      } else if (!user.googleId) {
        user.googleId = profile.id;
        user.oauthProvider = user.oauthProvider || 'google';
        await user.save();
      }
      done(null, user);
    } catch (e) { done(e); }
  }));
}

// ---------- Multer ----------
const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, uploadsDir),
  filename: (_, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const ok = /jpeg|jpg|png|gif|webp/.test(path.extname(file.originalname).toLowerCase()) &&
               /jpeg|jpg|png|gif|webp/.test(file.mimetype);
    cb(ok ? null : new Error('Only image files are allowed'), ok);
  },
});

// ---------- Helpers ----------
function escapeRegex(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function normalizeEmail(e) { return String(e || '').trim().toLowerCase(); }
function signToken(user) {
  return jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

async function authMiddleware(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'No token provided' });
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-passwordHash');
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (user.isBlocked) return res.status(403).json({ error: 'Account is blocked' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Like authMiddleware, but never rejects. Populates req.user if a valid token
// is present; otherwise leaves req.user undefined and proceeds. Used for
// endpoints that accept anonymous writes (public marketplace mode).
async function optionalAuth(req, _res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-passwordHash');
      if (user && !user.isBlocked) req.user = user;
    }
  } catch { /* anonymous */ }
  next();
}

function adminMiddleware(req, res, next) {
  if (!req.user || !req.user.isAdmin) return res.status(403).json({ error: 'Admin access required' });
  next();
}

async function persistBase64Images(images) {
  if (!Array.isArray(images)) return [];
  const out = [];
  for (const image of images) {
    if (typeof image !== 'string') continue;
    if (image.startsWith('data:image')) {
      const m = image.match(/^data:image\/([A-Za-z0-9+\-.]+);base64,(.+)$/);
      if (!m) continue;
      const ext = (m[1].split('/').pop() || 'png').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'png';
      const buf = Buffer.from(m[2], 'base64');
      if (buf.length > 10 * 1024 * 1024) continue;
      const filename = `listing-${Date.now()}-${Math.random().toString(36).slice(2, 11)}.${ext}`;
      await fsp.writeFile(path.join(uploadsDir, filename), buf);
      out.push(`/uploads/${filename}`);
    } else if (image.startsWith('/uploads/') || image.startsWith('http')) {
      out.push(image);
    }
  }
  return out;
}

// ---------- Routes ----------
app.get('/api/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));

// Register (matches walls.js EMAIL_REGISTER_URL = /api/register)
app.post('/api/register', authLimiter, async (req, res) => {
  try {
    const { name, password, profilePicture, phone, phoneCode, phoneAlt, phoneAltCode } = req.body;
    const email = normalizeEmail(req.body.email);
    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, password required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be 6+ chars' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'User already exists' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name, email, passwordHash,
      phone: phoneCode ? `${phoneCode} ${phone || ''}`.trim() : (phone || ''),
      phoneAlt: phoneAlt && phoneAltCode ? `${phoneAltCode} ${phoneAlt}` : (phoneAlt || ''),
      phoneCode: phoneCode || '+263',
      phoneAltCode: phoneAltCode || '+263',
      profilePicture: profilePicture || '',
    });

    res.status(201).json({ success: true, message: 'Registered', user, token: signToken(user) });
  } catch (e) {
    console.error('Register:', e.message);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login (matches walls.js EMAIL_LOGIN_URL = /api/login)
app.post('/api/login', authLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || '');
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.isBlocked) return res.status(403).json({ error: 'Account is blocked' });

    const hash = user.passwordHash || user.get('password');
    if (!hash) return res.status(401).json({ error: 'This account uses social login. Sign in with Google.' });

    const ok = await bcrypt.compare(password, hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    user.lastLogin = new Date();
    user.loginCount = (user.loginCount || 0) + 1;
    await user.save();

    res.json({ success: true, message: 'Login successful', user, token: signToken(user) });
  } catch (e) {
    console.error('Login:', e.message);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Current user
app.get('/api/user', authMiddleware, async (req, res) => {
  res.json({ success: true, user: req.user });
});

const PROFILE_WHITELIST = ['name', 'phone', 'phoneCode', 'phoneAlt', 'phoneAltCode', 'profilePicture'];
app.put('/api/user', authMiddleware, writeLimiter, async (req, res) => {
  try {
    const updates = {};
    for (const k of PROFILE_WHITELIST) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-passwordHash');
    res.json({ success: true, user });
  } catch (e) {
    console.error('Update user:', e.message);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Google OAuth (server-side) — kept for redirect-based flow alongside browser GIS
app.get('/api/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/api/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login', session: false }),
  (req, res) => {
    const token = signToken(req.user);
    const url = process.env.FRONTEND_URL || 'http://localhost:5500';
    res.redirect(`${url}/oauth-callback?token=${token}&provider=google`);
  });

// Optional: verify a Google id_token sent from the browser (walls.js GOOGLE_VERIFY_URL)
app.post('/api/auth/google/verify', authLimiter, async (req, res) => {
  try {
    const idToken = req.body && req.body.token;
    if (!idToken) return res.status(400).json({ error: 'token required' });
    const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken));
    if (!r.ok) return res.status(401).json({ error: 'Invalid Google token' });
    const payload = await r.json();
    if (process.env.GOOGLE_CLIENT_ID && payload.aud !== process.env.GOOGLE_CLIENT_ID) {
      return res.status(401).json({ error: 'Token audience mismatch' });
    }
    const email = (payload.email || '').toLowerCase();
    if (!email) return res.status(400).json({ error: 'Google profile has no email' });

    let user = await User.findOne({ googleId: payload.sub });
    if (!user) user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        name: payload.name || email,
        email,
        googleId: payload.sub,
        oauthProvider: 'google',
        profilePicture: payload.picture || '',
      });
    } else if (!user.googleId) {
      user.googleId = payload.sub;
      user.oauthProvider = user.oauthProvider || 'google';
      await user.save();
    }
    if (user.isBlocked) return res.status(403).json({ error: 'Account is blocked' });
    res.json({ success: true, user, token: signToken(user) });
  } catch (e) {
    console.error('Google verify:', e.message);
    res.status(500).json({ error: 'Google verification failed' });
  }
});

// Upload single image
app.post('/api/upload', authMiddleware, writeLimiter, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ success: true, url: `/uploads/${req.file.filename}` });
});

// ---------- Listings ----------
// POST /api/listings — optionalAuth so anonymous devices can post too.
// Stores the frontend's string id as `clientId` so subsequent edits/syncs
// can find the same record across devices.
app.post('/api/listings', optionalAuth, writeLimiter, async (req, res) => {
  try {
    const incoming = { ...req.body };
    const clientId = String(incoming.id || incoming.clientId || '').slice(0, 80);
    delete incoming._id; delete incoming.id;

    const data = { ...incoming, clientId };
    if (req.user) {
      data.createdBy = req.user._id;
      data.createdByEmail = req.user.email;
    } else {
      delete data.createdBy;
      data.createdByEmail = String(incoming.createdBy || incoming.createdByEmail || '').slice(0, 255);
    }
    if (data.images) data.images = await persistBase64Images(data.images);
    if (typeof data.price === 'string') {
      data.priceLabel = data.price;
      data.price = parseInt(data.price.replace(/[^0-9]/g, ''), 10) || 0;
    }

    // Upsert by clientId so duplicate creates from retries don't pile up.
    let listing;
    if (clientId) {
      listing = await Listing.findOneAndUpdate(
        { clientId },
        { $set: data },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
    } else {
      listing = await Listing.create(data);
    }
    const out = listing.toObject ? listing.toObject() : listing;
    out.id = out.clientId || String(out._id);
    res.status(201).json({ success: true, listing: out });
  } catch (e) {
    console.error('Create listing:', e.message);
    res.status(500).json({ error: 'Failed to create listing' });
  }
});

// PUT /api/listings/bulk — public bulk upsert used as the safety-net sync
// from the frontend. Each listing is upserted by clientId (or _id when valid).
// Must be registered BEFORE the '/api/listings/:id' routes so Express does
// not match 'bulk' as an :id parameter.
app.put('/api/listings/bulk', optionalAuth, writeLimiter, async (req, res) => {
  try {
    const arr = Array.isArray(req.body) ? req.body : (req.body && req.body.listings) || [];
    if (!Array.isArray(arr)) return res.status(400).json({ error: 'listings array required' });
    if (arr.length > 1000) return res.status(413).json({ error: 'Too many listings (max 1000)' });

    const ops = [];
    for (const raw of arr) {
      if (!raw || typeof raw !== 'object') continue;
      const incoming = { ...raw };
      const clientId = String(incoming.id || incoming.clientId || '').slice(0, 80);
      const rawId = incoming._id;
      delete incoming._id; delete incoming.id;
      delete incoming.createdAt; delete incoming.updatedAt;

      if (incoming.images) {
        try { incoming.images = await persistBase64Images(incoming.images); } catch { /* keep as-is */ }
      }
      if (typeof incoming.price === 'string') {
        incoming.priceLabel = incoming.price;
        incoming.price = parseInt(incoming.price.replace(/[^0-9]/g, ''), 10) || 0;
      }

      let filter = null;
      if (clientId) filter = { clientId };
      else if (rawId && mongoose.isValidObjectId(rawId)) filter = { _id: rawId };
      if (!filter) continue;

      const setDoc = { ...incoming, clientId: clientId || incoming.clientId || '' };
      ops.push({
        updateOne: { filter, update: { $set: setDoc }, upsert: true },
      });
    }
    if (ops.length) await Listing.bulkWrite(ops, { ordered: false });
    res.json({ success: true, synced: ops.length });
  } catch (e) {
    console.error('Bulk listings sync:', e.message);
    res.status(500).json({ error: 'Bulk sync failed' });
  }
});

app.get('/api/listings/popular', async (_req, res) => {
  try {
    const listings = await Listing.find({ isActive: true })
      .sort({ likes: -1, views: -1 })
      .limit(10)
      .populate('createdBy', 'name email phone profilePicture')
      .lean();
    res.json({ success: true, listings });
  } catch (e) {
    console.error('Popular:', e.message);
    res.status(500).json({ error: 'Failed to fetch popular listings' });
  }
});

app.get('/api/listings', async (req, res) => {
  try {
    const {
      category, search, minPrice, maxPrice, location, type,
      page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc',
    } = req.query;

    const query = { isActive: true };
    if (category && category !== 'All') query.categoryKey = String(category);

    if (search) {
      const safe = escapeRegex(search).slice(0, 80);
      query.$or = [
        { title: { $regex: safe, $options: 'i' } },
        { description: { $regex: safe, $options: 'i' } },
        { location: { $regex: safe, $options: 'i' } },
      ];
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseInt(String(minPrice).replace(/[^0-9]/g, ''), 10) || 0;
      if (maxPrice) query.price.$lte = parseInt(String(maxPrice).replace(/[^0-9]/g, ''), 10) || 0;
    }

    if (location && location !== 'Anywhere') {
      query.location = { $regex: escapeRegex(location).slice(0, 80), $options: 'i' };
    }

    if (type && type !== 'All types') {
      if (['New', 'Used - Like New', 'Used - Good', 'Used - Fair', 'For Parts'].includes(type)) {
        query.condition = type;
      } else {
        query.jobType = type;
      }
    }

    const pageN = Math.max(1, parseInt(page, 10) || 1);
    const limitN = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageN - 1) * limitN;
    const sort = { [String(sortBy)]: sortOrder === 'asc' ? 1 : -1 };

    // Bump default limit so freshly-created listings are visible without paging.
    const effectiveLimit = req.query.limit ? limitN : Math.min(200, Math.max(limitN, 100));
    const [listings, total] = await Promise.all([
      Listing.find(query)
        .sort(sort).skip(skip).limit(effectiveLimit)
        .populate('createdBy', 'name email phone profilePicture')
        .lean(),
      Listing.countDocuments(query),
    ]);

    const ids = listings.map(l => l._id);
    if (ids.length) Listing.updateMany({ _id: { $in: ids } }, { $inc: { views: 1 } }).catch(() => {});

    // Make sure the frontend always gets a usable `id` string.
    const shaped = listings.map(l => ({ ...l, id: l.clientId || String(l._id) }));

    res.json({
      success: true,
      listings: shaped,
      pagination: { page: pageN, limit: effectiveLimit, total, pages: Math.ceil(total / effectiveLimit) },
    });
  } catch (e) {
    console.error('List listings:', e.message);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

app.get('/api/listings/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Bad id' });
    const listing = await Listing.findByIdAndUpdate(
      req.params.id,
      { $inc: { views: 1 } },
      { new: true }
    ).populate('createdBy', 'name email phone profilePicture').lean();
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    const likeCount = await Like.countDocuments({ listingId: listing._id });

    let userLiked = false;
    const auth = req.headers.authorization || '';
    if (auth.startsWith('Bearer ')) {
      try {
        const decoded = jwt.verify(auth.slice(7), JWT_SECRET);
        const existing = await Like.findOne({ listingId: listing._id, userId: decoded.userId }).lean();
        userLiked = !!existing;
      } catch { /* ignore */ }
    }

    res.json({ success: true, listing: { ...listing, likes: likeCount, userLiked } });
  } catch (e) {
    console.error('Get listing:', e.message);
    res.status(500).json({ error: 'Failed to fetch listing' });
  }
});

// Resolve a listing by Mongo _id OR by frontend clientId (e.g. "listing_169...")
async function findListingByParamId(idParam) {
  if (mongoose.isValidObjectId(idParam)) {
    const byId = await Listing.findById(idParam);
    if (byId) return byId;
  }
  return Listing.findOne({ clientId: idParam });
}

app.put('/api/listings/:id', optionalAuth, writeLimiter, async (req, res) => {
  try {
    const listing = await findListingByParamId(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    // Anonymous (no createdBy) listings are editable by anyone. Owned
    // listings still require the owner or an admin.
    if (listing.createdBy && req.user &&
        listing.createdBy.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (listing.createdBy && !req.user) {
      return res.status(401).json({ error: 'Login required to edit this listing' });
    }
    if (req.body.images) req.body.images = await persistBase64Images(req.body.images);
    if (typeof req.body.price === 'string') {
      req.body.priceLabel = req.body.price;
      req.body.price = parseInt(req.body.price.replace(/[^0-9]/g, ''), 10) || 0;
    }
    delete req.body.createdBy; delete req.body.likes; delete req.body.views;
    delete req.body._id; delete req.body.id;
    Object.assign(listing, req.body);
    await listing.save();
    const out = listing.toObject();
    out.id = out.clientId || String(out._id);
    res.json({ success: true, listing: out });
  } catch (e) {
    console.error('Update listing:', e.message);
    res.status(500).json({ error: 'Failed to update listing' });
  }
});

app.delete('/api/listings/:id', optionalAuth, async (req, res) => {
  try {
    const listing = await findListingByParamId(req.params.id);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });
    if (listing.createdBy && req.user &&
        listing.createdBy.toString() !== req.user._id.toString() && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (listing.createdBy && !req.user) {
      return res.status(401).json({ error: 'Login required to delete this listing' });
    }
    listing.isActive = false;
    await listing.save();
    res.json({ success: true, message: 'Listing deleted' });
  } catch (e) {
    console.error('Delete listing:', e.message);
    res.status(500).json({ error: 'Failed to delete listing' });
  }
});

app.post('/api/listings/:id/like', authMiddleware, writeLimiter, async (req, res) => {
  try {
    const listingId = req.params.id;
    const userId = req.user._id;
    if (!mongoose.isValidObjectId(listingId)) return res.status(400).json({ error: 'Bad id' });

    const existing = await Like.findOne({ listingId, userId });
    let liked;
    if (existing) {
      await Like.deleteOne({ _id: existing._id });
      await Listing.updateOne({ _id: listingId }, { $inc: { likes: -1 } });
      liked = false;
    } else {
      try {
        await Like.create({ listingId, userId });
        await Listing.updateOne({ _id: listingId }, { $inc: { likes: 1 } });
        liked = true;
      } catch (err) {
        if (err.code !== 11000) throw err;
        liked = true;
      }
    }
    const likes = await Like.countDocuments({ listingId });
    res.json({ success: true, likes, liked });
  } catch (e) {
    console.error('Like:', e.message);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
});

// ---------- Enquiries ----------
app.post('/api/enquiries', authMiddleware, writeLimiter, async (req, res) => {
  try {
    const { listingId, notes } = req.body;
    if (!mongoose.isValidObjectId(listingId)) return res.status(400).json({ error: 'Bad listing id' });
    const listing = await Listing.findById(listingId);
    if (!listing) return res.status(404).json({ error: 'Listing not found' });

    const existing = await Enquiry.findOne({ listingId, userId: req.user._id });
    if (existing) {
      existing.notes = notes; existing.contactedAt = new Date();
      await existing.save();
    } else {
      await Enquiry.create({ listingId, userId: req.user._id, notes, contactedAt: new Date() });
      await Listing.updateOne({ _id: listingId }, { $inc: { enquiries: 1 } });
    }
    res.json({ success: true, message: 'Enquiry saved' });
  } catch (e) {
    console.error('Enquiry:', e.message);
    res.status(500).json({ error: 'Failed to save enquiry' });
  }
});

app.get('/api/enquiries', authMiddleware, async (req, res) => {
  try {
    const enquiries = await Enquiry.find({ userId: req.user._id })
      .sort({ contactedAt: -1 }).limit(50)
      .populate({ path: 'listingId', select: 'title price priceLabel location categoryLabel images' })
      .lean();
    res.json({ success: true, enquiries });
  } catch (e) {
    console.error('Get enquiries:', e.message);
    res.status(500).json({ error: 'Failed to fetch enquiries' });
  }
});

app.get('/api/user/listings', authMiddleware, async (req, res) => {
  try {
    const listings = await Listing.find({ createdBy: req.user._id })
      .sort({ createdAt: -1 })
      .populate('createdBy', 'name email phone profilePicture')
      .lean();
    res.json({ success: true, listings });
  } catch (e) {
    console.error('User listings:', e.message);
    res.status(500).json({ error: 'Failed to fetch user listings' });
  }
});

app.get('/api/categories', async (_req, res) => {
  try {
    const categories = await Listing.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$categoryLabel', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    res.json({ success: true, categories });
  } catch (e) {
    console.error('Categories:', e.message);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

app.get('/api/search', async (req, res) => {
  try {
    const { q, category, location } = req.query;
    const query = { isActive: true };
    if (q) {
      const safe = escapeRegex(q).slice(0, 80);
      query.$or = [
        { title: { $regex: safe, $options: 'i' } },
        { description: { $regex: safe, $options: 'i' } },
        { location: { $regex: safe, $options: 'i' } },
      ];
    }
    if (category && category !== 'All') query.categoryKey = String(category);
    if (location && location !== 'Anywhere') {
      query.location = { $regex: escapeRegex(location).slice(0, 80), $options: 'i' };
    }
    const listings = await Listing.find(query).limit(20)
      .populate('createdBy', 'name email phone profilePicture').lean();
    res.json({ success: true, listings });
  } catch (e) {
    console.error('Search:', e.message);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ---------- Admin ----------
app.get('/api/admin/stats', authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    const [totalUsers, totalListings, activeListings, totalEnquiries, popularListings] = await Promise.all([
      User.countDocuments(),
      Listing.countDocuments(),
      Listing.countDocuments({ isActive: true }),
      Enquiry.countDocuments(),
      Listing.find({ isActive: true }).sort({ likes: -1, views: -1 }).limit(5)
        .populate('createdBy', 'name email').lean(),
    ]);
    res.json({ success: true, stats: { totalUsers, totalListings, activeListings, totalEnquiries, popularListings } });
  } catch (e) {
    console.error('Admin stats:', e.message);
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});

app.get('/api/admin/users', authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    const users = await User.find().select('-passwordHash').sort({ createdAt: -1 }).lean();
    res.json({ success: true, users });
  } catch (e) {
    console.error('Admin users:', e.message);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.put('/api/admin/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const update = {};
    if (typeof req.body.isAdmin === 'boolean') update.isAdmin = req.body.isAdmin;
    if (typeof req.body.isBlocked === 'boolean') update.isBlocked = req.body.isBlocked;
    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('-passwordHash');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, user });
  } catch (e) {
    console.error('Admin update user:', e.message);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// ---------- Static & SPA fallback ----------
app.use('/uploads', express.static(uploadsDir, { maxAge: '7d', immutable: true }));
//app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1d' }));

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));
//app.get('*', (_req, res) => //res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.use((err, _req, res, _next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error', message: IS_PROD ? undefined : err.message });
});

// ---------- Boot ----------
connectDb();
const server = app.listen(PORT, () => {
  console.log(`🚀 Server on :${PORT} (${NODE_ENV})`);
  if (!process.env.GOOGLE_CLIENT_ID) console.warn('⚠️  Google OAuth not configured');
});

function shutdown(sig) {
  console.log(`\n${sig} received, shutting down...`);
  server.close(() => mongoose.disconnect().finally(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
