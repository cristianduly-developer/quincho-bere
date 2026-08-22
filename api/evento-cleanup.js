import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET')
    return res.status(405).json({ error: 'Method not allowed' });

  const cronSecret = process.env.CRON_SECRET;
  const appKey = process.env.ERROR_REPORT_KEY;
  const incomingAppKey = req.headers['x-app-key'] || '';
  const auth = (req.headers['authorization'] || '').replace('Bearer ', '').trim();
  const param = req.query?.secret;
  const authorized = (cronSecret && (auth === cronSecret || param === cronSecret))
    || (appKey && incomingAppKey === appKey);
  if (!authorized)
    return res.status(401).json({ error: 'unauthorized' });

  const supabase = createClient(
    process.env.VITE_SUPA_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 10);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const { data: expired, error: fetchErr } = await supabase
    .from('reservas')
    .select('id, share_token')
    .not('share_token', 'is', null)
    .lt('fecha', cutoffStr);

  if (fetchErr) {
    console.error('[evento-cleanup] fetch error:', fetchErr.message);
    return res.status(500).json({ error: fetchErr.message });
  }

  if (!expired?.length)
    return res.status(200).json({ cleaned: 0, message: 'No expired events' });

  let cleaned = 0;
  for (const r of expired) {
    const { data: fotos } = await supabase
      .from('evento_fotos')
      .select('id, url')
      .eq('reserva_id', r.id);

    if (fotos?.length) {
      const paths = fotos
        .map(f => {
          const match = f.url?.match(/evento-fotos\/(.+)$/);
          return match ? match[1] : null;
        })
        .filter(Boolean);

      if (paths.length)
        await supabase.storage.from('evento-fotos').remove(paths);

      await supabase.from('evento_fotos').delete().eq('reserva_id', r.id);
    }

    await supabase.from('evento_rsvp').delete().eq('reserva_id', r.id);

    await supabase
      .from('reservas')
      .update({
        share_token: null,
        share_sections: null,
        share_message: null,
        share_hero_url: null,
      })
      .eq('id', r.id);

    cleaned++;
  }

  console.log(`[evento-cleanup] Cleaned ${cleaned} expired events`);
  return res.status(200).json({ cleaned, cutoff: cutoffStr });
}
