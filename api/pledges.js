import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
const LIST_KEY = 'pledges:list';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const entries = (await redis.get(LIST_KEY)) || [];
      const totals = entries.reduce(
        (acc, e) => {
          acc.pledges += 1;
          acc.copies += Number(e.copies) || 0;
          acc.amount += Number(e.amount) || 0;
          return acc;
        },
        { pledges: 0, copies: 0, amount: 0 }
      );
      res.status(200).json({ entries: entries.slice().reverse(), totals });
    } catch (err) {
      console.error('GET /api/pledges failed', err);
      res.status(500).json({ error: 'Unable to load pledges right now.' });
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      const { name, organization, phone, email, copies, amount } = req.body || {};

      if (!name || !String(name).trim() || (!Number(copies) && !Number(amount))) {
        res.status(400).json({ error: 'Add your name and at least one copy or a pledge amount.' });
        return;
      }

      const entry = {
        name: String(name).trim().slice(0, 120),
        organization: organization ? String(organization).trim().slice(0, 160) : '',
        phone: phone ? String(phone).trim().slice(0, 40) : '',
        email: email ? String(email).trim().slice(0, 160) : '',
        copies: Math.max(0, Math.min(100000, Number(copies) || 0)),
        amount: Math.max(0, Math.min(1000000000, Number(amount) || 0)),
        ts: Date.now(),
      };

      const entries = (await redis.get(LIST_KEY)) || [];
      entries.push(entry);
      await redis.set(LIST_KEY, entries);

      res.status(201).json({ ok: true });
    } catch (err) {
      console.error('POST /api/pledges failed', err);
      res.status(500).json({ error: 'Unable to save your pledge right now.' });
    }
    return;
  }

  res.setHeader('Allow', 'GET, POST');
  res.status(405).json({ error: 'Method not allowed.' });
}
