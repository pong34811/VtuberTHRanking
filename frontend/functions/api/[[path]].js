// Cloudflare Pages Functions API
// File: frontend/functions/api/[[path]].js

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import auth, { requireUser } from '../../server/auth.js';
import admin from '../../server/admin.js';
import publicApi from '../../server/public.js';

const app = new Hono();

app.use('*', cors({
  origin: (origin) => {
    if (!origin) return null;
    if (/^https:\/\/[\w-]*\.?vtuberthai-ranking\.pages\.dev$/.test(origin)) return origin;
    if (origin === 'http://localhost:5173' || origin === 'http://localhost:4173') return origin;
    return null;
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'X-CSRF-Token'],
  exposeHeaders: ['Content-Type'],
  credentials: true,
  maxAge: 86400,
}));

// Auth routes (login/setup/logout) - mounted before admin so requireUser can run
app.route('/api/v1/auth', auth);

// Admin routes - protected by requireUser middleware (sets c.user and c.session)
app.use('/api/v1/admin/*', requireUser);
app.route('/api/v1/admin', admin);

// Public API
app.route('/api/v1', publicApi);

app.onError((err, c) => {
  console.error('Worker error:', err);
  return c.json({ error: true, status: 500, message: 'Internal server error' }, 500);
});

export const onRequest = async (context) => {
  try {
    return await app.fetch(context.request, context.env);
  } catch (err) {
    console.error('Unhandled error:', err);
    return new Response(JSON.stringify({ error: true, status: 500, message: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
