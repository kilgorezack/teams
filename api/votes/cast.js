// Vercel Serverless Function — POST /api/votes/cast
// Inserts a vote record into Supabase. Returns { ok: true } or { error: "already_voted" }.

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

  if (req.method !== 'POST') {
    res.writeHead(405, { ...corsHeaders(), 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'method_not_allowed' }));
    return;
  }

  // Parse body (Vercel provides req.body when Content-Type is application/json)
  const { meetingId, userId, voteType, nomineeId } = req.body || {};

  if (!meetingId || !userId || !voteType) {
    res.writeHead(400, { ...corsHeaders(), 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'missing_fields' }));
    return;
  }

  if (!['end', 'remove'].includes(voteType)) {
    res.writeHead(400, { ...corsHeaders(), 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'invalid_vote_type' }));
    return;
  }

  if (voteType === 'remove' && !nomineeId) {
    res.writeHead(400, { ...corsHeaders(), 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'nominee_id_required_for_remove_vote' }));
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Quorum cast: missing Supabase env vars');
    res.writeHead(500, { ...corsHeaders(), 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'server_misconfigured' }));
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { error } = await supabase.from('votes').insert({
    meeting_id: meetingId,
    user_id: userId,
    vote_type: voteType,
    nominee_id: nomineeId || null,
  });

  if (error) {
    // Unique constraint violation — user already voted this type in this meeting
    if (error.code === '23505') {
      res.writeHead(409, { ...corsHeaders(), 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'already_voted' }));
      return;
    }
    console.error('Quorum cast: Supabase insert error', error);
    res.writeHead(500, { ...corsHeaders(), 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'db_error', detail: error.message }));
    return;
  }

  res.writeHead(200, { ...corsHeaders(), 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true }));
};
