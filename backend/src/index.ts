import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authRoutes } from './routes/auth.js';
import { portalRoutes } from './routes/portal.js';
import { moveRoutes } from './routes/move.js';
import { combatRoutes } from './routes/combat.js';
import { craftRoutes } from './routes/craft.js';

const app = new Hono<{ Bindings: { DATABASE_URL?: string } }>();

app.use('*', cors());

app.route('/api/auth', authRoutes);
app.route('/api', portalRoutes);
app.route('/api', moveRoutes);
app.route('/api/combat', combatRoutes);
app.route('/api/craft', craftRoutes);

export default app;
