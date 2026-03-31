// Vercel Serverless Function — GET /api/votes/state?meetingId=<id>
// Returns current votes for a meeting from the last 90 seconds.
// Response shape:
//   {
//     endVotes: [userId, ...],
//     removeVotes: { [nomineeId]: [userId, ...] },
//     nomineeId: string | null,
//     nomineeName: string | null,
//   }

const { createClient } = require('@supabase/supabase-js');

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

module.exports = async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    res.writeHead(405, { ...corsHeaders(), 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'method_not_allowed' }));
    return;
  }

  const meetingId = req.query?.meetingId;

  if (!meetingId) {
    res.writeHead(400, { ...corsHeaders(), 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'meetingId_required' }));
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Quorum state: missing Supabase env vars');
    res.writeHead(500, { ...corsHeaders(), 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'server_misconfigured' }));
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Fetch votes from the last 90 seconds for this meeting
  const cutoff = new Date(Date.now() - 90 * 1000).toISOString();

  const { data, error } = await supabase
    .from('votes')
    .select('user_id, vote_type, nominee_id, created_at')
    .eq('meeting_id', meetingId)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Quorum state: Supabase select error', error);
    res.writeHead(500, { ...corsHeaders(), 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'db_error', detail: error.message }));
    return;
  }

  // Build response
  const endVotes = [];
  const removeVotes = {}; // nomineeId -> [userId, ...]
  let nomineeId = null;
  let nomineeName = null; // not stored in DB, but we track nomineeId as a slug

  for (const row of data || []) {
    if (row.vote_type === 'end') {
      if (!endVotes.includes(row.user_id)) {
        endVotes.push(row.user_id);
      }
    } else if (row.vote_type === 'remove' && row.nominee_id) {
      if (!removeVotes[row.nominee_id]) {
        removeVotes[row.nominee_id] = [];
      }
      if (!removeVotes[row.nominee_id].includes(row.user_id)) {
        removeVotes[row.nominee_id].push(row.user_id);
      }
      // The most-voted-for nominee (or first encountered) becomes the active one
      if (!nomineeId) {
        nomineeId = row.nominee_id;
        // Derive a human-readable name from the slug (nominee-john-doe -> John Doe)
        nomineeName = row.nominee_id
          .replace(/^nominee-/, '')
          .replace(/-/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase());
      }
    }
  }

  // If multiple nominees exist, pick the one with the most votes
  if (Object.keys(removeVotes).length > 1) {
    nomineeId = Object.keys(removeVotes).reduce((a, b) =>
      removeVotes[a].length >= removeVotes[b].length ? a : b
    );
    nomineeName = nomineeId
      .replace(/^nominee-/, '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  res.writeHead(200, { ...corsHeaders(), 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ endVotes, removeVotes, nomineeId, nomineeName }));
};
