// =============================================================================
// Wheels & Walls — server.js  (S3 image storage + full features)
// -----------------------------------------------------------------------------
// Replace your existing server.js with this file.
//
// All images are stored in S3. The client can upload directly via pre‑signed
// URLs (/api/uploads/sign) OR the backend can convert base64 strings to S3.
// No local disk storage is used, so redeploys never lose images.
// =============================================================================

require('dotenv').config();

const path = require('path');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const webpush = require('web-push');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-me';
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';

// VAPID for push notifications (optional)
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else {
  console.warn('[push] VAPID keys missing — push notifications disabled.');
}

// S3 setup
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  } : undefined,
});
const S3_BUCKET = process.env.AWS_BUCKET;

if (!S3_BUCKET) console.warn('[s3] AWS_BUCKET not set – S3 uploads disabled');

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const app = express();
app.use(cors({ origin: CLIENT_ORIGIN === '*' ? true : CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: '15mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname))); // serves index.html, walls.js, etc.

// ---------------------------------------------------------------------------
// DB Models (unchanged, but with consistent naming)
// ---------------------------------------------------------------------------
mongoose.set('strictQuery', false);
mongoose.connect(MONGODB_URI).then(
  () => console.log('[db] connected'),
  (e) => console.error('[db] connect error', e)
);

const UserSchema = new mongoose.Schema({
  email:    { type: String, unique: true, required: true, index: true },
  password: String,
  name:     String,
  provider: { type: String, default: 'local' },
  createdAt:{ type: Date,   default: Date.now },
}, { versionKey: false });

const ListingSchema = new mongoose.Schema({
  ownerId : { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
  type    : { type: String, index: true },
  title   : String,
  description: String,
  price   : { type: Number, default: 0 },
  currency: { type: String, default: 'USD' },
  location: String,
  lat     : Number,
  lng     : Number,
  images  : [String],                              // S3 URLs
  features: [String],
  fields  : { type: mongoose.Schema.Types.Mixed, default: {} },
  likedBy : [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
  bids    : [{
    userId   : { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    amount   : Number,
    createdAt: { type: Date, default: Date.now },
  }],
  status  : { type: String, default: 'active' },
  createdAt:{ type: Date,   default: Date.now, index: true },
  updatedAt:{ type: Date,   default: Date.now },
}, { versionKey: false });

const SavedSearchSchema = new mongoose.Schema({
  userId : { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
  name   : String,
  query  : String,
  filters: { type: mongoose.Schema.Types.Mixed, default: {} },
  notify : { type: Boolean, default: true },
  createdAt:{ type: Date, default: Date.now },
}, { versionKey: false });

const PushSubscriptionSchema = new mongoose.Schema({
  userId      : { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  endpoint    : { type: String, unique: true, required: true },
  keys        : { p256dh: String, auth: String },
  userAgent   : String,
  createdAt   : { type: Date, default: Date.now },
}, { versionKey: false });

const NotificationSchema = new mongoose.Schema({
  userId   : { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  type     : String,
  title    : String,
  body     : String,
  data     : { type: mongoose.Schema.Types.Mixed, default: {} },
  read     : { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, index: true },
}, { versionKey: false });

const MessageSchema = new mongoose.Schema({
  fromId   : { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  toId     : { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing' },
  text     : String,
  read     : { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
}, { versionKey: false });

const User             = mongoose.model('User',             UserSchema);
const Listing          = mongoose.model('Listing',          ListingSchema);
const SavedSearch      = mongoose.model('SavedSearch',      SavedSearchSchema);
const PushSubscription = mongoose.model('PushSubscription', PushSubscriptionSchema);
const Notification     = mongoose.model('Notification',     NotificationSchema);
const Message          = mongoose.model('Message',          MessageSchema);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function signToken(user) {
  return jwt.sign({ id: user._id.toString(), email: user.email }, JWT_SECRET, { expiresIn: '30d' });
}

function authRequired(req, res, next) {
  const h = req.headers.authorization || '';
  const bearer = h.startsWith('Bearer ') ? h.slice(7) : null;
  const token  = bearer || req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'unauthenticated' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'invalid token' });
  }
}

function authOptional(req, _res, next) {
  const h = req.headers.authorization || '';
  const bearer = h.startsWith('Bearer ') ? h.slice(7) : null;
  const token  = bearer || req.cookies?.token;
  if (token) { try { req.user = jwt.verify(token, JWT_SECRET); } catch {} }
  next();
}

function toNumberPrice(v) {
  if (typeof v === 'number') return v;
  if (v == null) return 0;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function publicListing(doc, viewerId) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id         : o._id?.toString?.() || o.id,
    ownerId    : o.ownerId?.toString?.() || o.ownerId,
    type       : o.type,
    title      : o.title,
    description: o.description,
    price      : o.price,
    priceText  : String(o.price ?? ''),
    currency   : o.currency,
    location   : o.location,
    lat        : o.lat, lng: o.lng,
    images     : Array.isArray(o.images) ? o.images : [],
    features   : Array.isArray(o.features) ? o.features : [],
    fields     : o.fields || {},
    likeCount  : Array.isArray(o.likedBy) ? o.likedBy.length : 0,
    likedByMe  : viewerId ? (o.likedBy || []).some(id => id.toString() === viewerId) : false,
    bids       : (o.bids || []).map(b => ({
      userId: b.userId?.toString?.(), amount: b.amount, createdAt: b.createdAt,
    })),
    status     : o.status,
    createdAt  : o.createdAt,
    updatedAt  : o.updatedAt,
  };
}

// Convert base64 image string to S3 URL
async function uploadBase64ToS3(base64String, userId) {
  if (!S3_BUCKET) throw new Error('S3 not configured');
  const matches = base64String.match(/^data:image\/([A-Za-z0-9+\-.]+);base64,(.+)$/);
  if (!matches) throw new Error('Invalid base64 image');
  const ext = matches[1].split('/').pop() || 'png';
  const buffer = Buffer.from(matches[2], 'base64');
  const key = `listings/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: `image/${ext}`,
  });
  await s3.send(command);
  return `https://${S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email + password required' });
    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ error: 'email already registered' });
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, password: hash, name: name || '' });
    const token = signToken(user);
    res.json({ token, user: { id: user._id, email: user.email, name: user.name } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const user = await User.findOne({ email });
    if (!user || !user.password) return res.status(401).json({ error: 'invalid credentials' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });
    const token = signToken(user);
    res.json({ token, user: { id: user._id, email: user.email, name: user.name } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/auth/me', authRequired, async (req, res) => {
  const u = await User.findById(req.user.id).lean();
  if (!u) return res.status(404).json({ error: 'not found' });
  res.json({ user: { id: u._id, email: u.email, name: u.name, provider: u.provider } });
});

app.post('/api/auth/oauth', async (req, res) => {
  try {
    const { provider, email, name } = req.body || {};
    if (!email) return res.status(400).json({ error: 'email required' });
    let user = await User.findOne({ email });
    if (!user) user = await User.create({ email, name: name || '', provider: provider || 'oauth' });
    res.json({ token: signToken(user), user: { id: user._id, email: user.email, name: user.name } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------
app.get('/api/listings', authOptional, async (req, res) => {
  try {
    const { type, q, mine, ownerId, limit = 100 } = req.query;
    const where = { status: { $ne: 'hidden' } };
    if (type) where.type = type;
    if (q)    where.$or = [
      { title:       { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } },
      { location:    { $regex: q, $options: 'i' } },
    ];
    if (mine === '1' && req.user) where.ownerId = req.user.id;
    else if (ownerId) where.ownerId = ownerId;

    const docs = await Listing.find(where).sort({ createdAt: -1 }).limit(Number(limit));
    res.json(docs.map(d => publicListing(d, req.user?.id)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/listings/:id', authOptional, async (req, res) => {
  try {
    const d = await Listing.findById(req.params.id);
    if (!d) return res.status(404).json({ error: 'not found' });
    res.json(publicListing(d, req.user?.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/listings', authRequired, async (req, res) => {
  try {
    const body = req.body || {};
    let images = [];

    // 1) Client may already have S3 URLs (e.g. from pre‑signed upload)
    if (Array.isArray(body.images)) images = body.images.filter(Boolean);
    else if (typeof body.images === 'string' && body.images.trim().startsWith('[')) {
      try { images = JSON.parse(body.images); } catch {}
    }

    // 2) Base64 fallback – convert to S3
    if (Array.isArray(body.imagesBase64)) {
      for (const base64 of body.imagesBase64) {
        try {
          const s3url = await uploadBase64ToS3(base64, req.user.id);
          images.push(s3url);
        } catch (err) {
          console.warn('[s3] base64 upload failed:', err.message);
        }
      }
    }

    // Store all other form fields as "fields"
    const knownFields = new Set([
      'type','title','description','price','currency','location','lat','lng',
      'images','imagesBase64','features',
    ]);
    const extras = {};
    for (const k of Object.keys(body)) if (!knownFields.has(k)) extras[k] = body[k];

    const doc = await Listing.create({
      ownerId    : req.user.id,
      type       : body.type,
      title      : body.title,
      description: body.description,
      price      : toNumberPrice(body.price),
      currency   : body.currency || 'USD',
      location   : body.location,
      lat        : body.lat ? Number(body.lat) : undefined,
      lng        : body.lng ? Number(body.lng) : undefined,
      images,
      features   : Array.isArray(body.features) ? body.features
                  : (typeof body.features === 'string' && body.features.startsWith('[')
                      ? (()=>{ try { return JSON.parse(body.features); } catch { return []; } })()
                      : []),
      fields     : extras,
    });

    // Fire-and-forget: match saved searches and push
    matchAndNotify(doc).catch(e => console.error('[matcher]', e));

    res.json(publicListing(doc, req.user.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/listings/:id', authRequired, async (req, res) => {
  try {
    const doc = await Listing.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'not found' });
    if (doc.ownerId.toString() !== req.user.id) return res.status(403).json({ error: 'forbidden' });

    const b = req.body || {};
    const updatable = ['type','title','description','currency','location','images','features','status'];
    for (const k of updatable) if (k in b) doc[k] = b[k];
    if ('price' in b) doc.price = toNumberPrice(b.price);
    if ('lat'   in b) doc.lat   = Number(b.lat);
    if ('lng'   in b) doc.lng   = Number(b.lng);
    if (b.fields && typeof b.fields === 'object') doc.fields = { ...(doc.fields || {}), ...b.fields };
    doc.updatedAt = new Date();
    await doc.save();
    res.json(publicListing(doc, req.user.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/listings/:id', authRequired, async (req, res) => {
  try {
    const doc = await Listing.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'not found' });
    if (doc.ownerId.toString() !== req.user.id) return res.status(403).json({ error: 'forbidden' });

    // Delete images from S3 (best effort)
    if (S3_BUCKET) {
      for (const url of (doc.images || [])) {
        const key = s3KeyFromUrl(url);
        if (key) {
          try { await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key })); }
          catch (e) { console.warn('[s3] delete failed', key, e.message); }
        }
      }
    }
    await doc.deleteOne();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------------------------------------------------------------------------
// Likes
// ---------------------------------------------------------------------------
app.post('/api/listings/:id/like', authRequired, async (req, res) => {
  try {
    const uid = req.user.id;
    const doc = await Listing.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'not found' });
    const idx = (doc.likedBy || []).findIndex(x => x.toString() === uid);
    if (idx >= 0) doc.likedBy.splice(idx, 1); else doc.likedBy.push(uid);
    await doc.save();
    res.json({ liked: idx < 0, likeCount: doc.likedBy.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------------------------------------------------------------------------
// Bids
// ---------------------------------------------------------------------------
app.post('/api/listings/:id/bid', authRequired, async (req, res) => {
  try {
    const amount = toNumberPrice(req.body?.amount);
    if (!amount) return res.status(400).json({ error: 'amount required' });
    const doc = await Listing.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'not found' });
    doc.bids.push({ userId: req.user.id, amount });
    await doc.save();

    // Notify owner
    await pushToUser(doc.ownerId, {
      title: 'New bid on your listing',
      body : `${doc.title}: ${doc.currency || ''}${amount}`,
      data : { listingId: doc._id.toString(), type: 'bid' },
    });
    res.json(publicListing(doc, req.user.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------------------------------------------------------------------------
// Saved searches
// ---------------------------------------------------------------------------
app.get('/api/saved-searches', authRequired, async (req, res) => {
  const list = await SavedSearch.find({ userId: req.user.id }).sort({ createdAt: -1 }).lean();
  res.json(list.map(s => ({ ...s, id: s._id })));
});

app.post('/api/saved-searches', authRequired, async (req, res) => {
  try {
    const { name, query, filters, notify } = req.body || {};
    const doc = await SavedSearch.create({
      userId: req.user.id,
      name: name || query || 'Saved search',
      query: query || '',
      filters: filters || {},
      notify: notify !== false,
    });
    res.json({ ...doc.toObject(), id: doc._id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/saved-searches/:id', authRequired, async (req, res) => {
  const r = await SavedSearch.deleteOne({ _id: req.params.id, userId: req.user.id });
  res.json({ ok: r.deletedCount > 0 });
});

// ---------------------------------------------------------------------------
// Push notifications
// ---------------------------------------------------------------------------
app.get('/api/push/public-key', (_req, res) => {
  res.json({ key: VAPID_PUBLIC_KEY });
});

app.post('/api/push/subscribe', authRequired, async (req, res) => {
  try {
    const sub = req.body?.subscription || req.body;
    if (!sub?.endpoint) return res.status(400).json({ error: 'subscription required' });
    await PushSubscription.findOneAndUpdate(
      { endpoint: sub.endpoint },
      {
        userId   : req.user.id,
        endpoint : sub.endpoint,
        keys     : sub.keys || {},
        userAgent: req.headers['user-agent'] || '',
      },
      { upsert: true, new: true }
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/push/unsubscribe', authRequired, async (req, res) => {
  const endpoint = req.body?.endpoint || req.query?.endpoint;
  if (!endpoint) return res.status(400).json({ error: 'endpoint required' });
  await PushSubscription.deleteOne({ endpoint, userId: req.user.id });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// In‑app notifications
// ---------------------------------------------------------------------------
app.get('/api/notifications', authRequired, async (req, res) => {
  const list = await Notification.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(100).lean();
  res.json(list.map(n => ({ ...n, id: n._id })));
});

app.post('/api/notifications/:id/read', authRequired, async (req, res) => {
  await Notification.updateOne({ _id: req.params.id, userId: req.user.id }, { $set: { read: true } });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------
app.get('/api/messages', authRequired, async (req, res) => {
  const list = await Message.find({ $or: [{ fromId: req.user.id }, { toId: req.user.id }] })
                            .sort({ createdAt: -1 }).limit(200).lean();
  res.json(list.map(m => ({ ...m, id: m._id })));
});

app.post('/api/messages', authRequired, async (req, res) => {
  try {
    const { toId, listingId, text } = req.body || {};
    if (!toId || !text) return res.status(400).json({ error: 'toId + text required' });
    const m = await Message.create({ fromId: req.user.id, toId, listingId, text });
    await pushToUser(toId, {
      title: 'New message',
      body : text.slice(0, 120),
      data : { type: 'message', listingId, fromId: req.user.id },
    });
    res.json({ ...m.toObject(), id: m._id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------------------------------------------------------------------------
// S3 pre‑signed upload URL (for client‑side direct uploads)
// ---------------------------------------------------------------------------
app.post('/api/uploads/sign', authRequired, async (req, res) => {
  try {
    if (!S3_BUCKET) return res.status(500).json({ error: 'S3 not configured' });
    const { filename = 'upload.bin', contentType = 'application/octet-stream' } = req.body || {};
    const safe = String(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
    const key  = `listings/${req.user.id}/${Date.now()}-${Math.random().toString(36).slice(2,8)}-${safe}`;
    const cmd  = new PutObjectCommand({
      Bucket: S3_BUCKET, Key: key, ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 300 });
    const publicUrl = `https://${S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    res.json({ uploadUrl, publicUrl, key, method: 'PUT', headers: { 'Content-Type': contentType } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

function s3KeyFromUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const m = url.match(/amazonaws\.com\/(.+)$/);
  return m ? decodeURIComponent(m[1]) : null;
}

// ---------------------------------------------------------------------------
// Saved‑search matcher + push helpers
// ---------------------------------------------------------------------------
function listingMatchesSearch(listing, search) {
  const f = search.filters || {};
  const q = (search.query || '').trim().toLowerCase();
  if (f.type && listing.type !== f.type) return false;
  if (f.minPrice != null && listing.price < Number(f.minPrice)) return false;
  if (f.maxPrice != null && listing.price > Number(f.maxPrice)) return false;
  if (f.location && !(listing.location || '').toLowerCase().includes(String(f.location).toLowerCase())) return false;
  if (q) {
    const hay = `${listing.title || ''} ${listing.description || ''} ${listing.location || ''}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

async function matchAndNotify(listing) {
  const searches = await SavedSearch.find({ notify: true, userId: { $ne: listing.ownerId } }).lean();
  for (const s of searches) {
    if (!listingMatchesSearch(listing, s)) continue;
    await Notification.create({
      userId: s.userId,
      type  : 'saved_search_match',
      title : 'New match for your saved search',
      body  : listing.title || 'A new listing matches your saved search',
      data  : { listingId: listing._id.toString(), savedSearchId: s._id.toString() },
    });
    await pushToUser(s.userId, {
      title: 'New match: ' + (s.name || s.query || 'saved search'),
      body : listing.title || '',
      data : { listingId: listing._id.toString(), type: 'saved_search_match' },
    });
  }
}

async function pushToUser(userId, payload) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;
  const subs = await PushSubscription.find({ userId });
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: s.keys },
        JSON.stringify(payload)
      );
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await PushSubscription.deleteOne({ _id: s._id });
      } else {
        console.warn('[push] send failed', err.statusCode, err.body || err.message);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// SPA fallback (must be after all /api routes)
// ---------------------------------------------------------------------------
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
app.listen(PORT, () => console.log(`[server] listening on ${PORT}`));