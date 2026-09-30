// Cloudflare Pages Functions API
// File: frontend/functions/api/[[path]].js

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { logSafeError } from '../../server/request-body.js';
import auth, { requireUser } from '../../server/auth.js';
import admin from '../../server/admin.js';
import publicApi from '../../server/public.js';

const app = new Hono();

app.use('*', cors({
  origin: (origin, c) => {
    if (!origin) return null;
    if (/^https:\/\/(?:[a-z0-9-]+\.)?vtuberthai-ranking\.pages\.dev$/.test(origin)) return origin;
    if (c.env.ENVIRONMENT === 'development' && (origin === 'http://localhost:5173' || origin === 'http://localhost:4173')) return origin;
    return null;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'X-CSRF-Token'],
  exposeHeaders: ['Content-Type', 'Retry-After'],
  credentials: true,
  maxAge: 86400,
}));

// Pages previews must never silently inherit a production D1 binding.
// CORS remains independent: a legitimate preview origin is not authorization.
app.use('*', async (c, next) => {
  const host = new URL(c.req.url).hostname;
  const preview = /^[a-z0-9-]+\.vtuberthai-ranking\.pages\.dev$/.test(host);
  if (preview && !['staging', 'development'].includes(c.env.ENVIRONMENT) && !/^\/api\/v1\/?$/.test(c.req.path)) {
    c.header('Cache-Control', 'no-store');
    c.header('X-Robots-Tag', 'noindex, nofollow');
    c.header('Retry-After', '300');
    return c.json({ error: true, status: 503, message: 'Preview database access is not configured' }, 503);
  }
  return next();
});

// Auth routes (login/setup/logout) - mounted before admin so requireUser can run
app.route('/api/v1/auth', auth);

// Admin routes - protected by requireUser middleware (sets c.user and c.session)
app.use('/api/v1/admin/*', requireUser);
app.route('/api/v1/admin', admin);

// Public API
// Hono's sub-router root is mounted without the trailing slash.
app.get('/api/v1/', c => c.json({ status: 'ok', service: 'VTuber Thai Ranking API' }));
app.route('/api/v1', publicApi);

app.onError((err, c) => {
  if (err instanceof HTTPException) return c.json({ error: true, status: err.status, message: err.message }, err.status);
  logSafeError('API operation failed');
  return c.json({ error: true, status: 500, message: 'Internal server error' }, 500);
});

export const onRequest = async (context) => {
  try {
    return await app.fetch(context.request, context.env);
  } catch (err) {
    logSafeError('Unhandled API operation failed');
    return new Response(JSON.stringify({ error: true, status: 500, message: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
