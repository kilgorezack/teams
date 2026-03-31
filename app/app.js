/* ============================================================
   Quorum — Teams Meeting Side Panel
   app.js — Full application logic
   ============================================================ */

'use strict';

// ── State ─────────────────────────────────────────────────────────────────────
let supabase = null;
let channel = null;

let meetingId = null;
let userId = null;
let userDisplayName = null;

let presenceCount = 1;           // number of panel users (including self)
let endVoters = new Set();       // userIds who voted to end
let removeVoters = new Set();    // userIds who voted to remove
let currentNomineeId = null;     // userId of nominated person
let currentNomineeName = null;   // display name of nominated person

let hasVotedEnd = false;
let hasVotedRemove = false;
let meetingOverTriggered = false;
let removeQuorumTriggered = false;

// ── Helpers ───────────────────────────────────────────────────────────────────
function randomId() {
  return 'dev-' + Math.random().toString(36).slice(2, 10);
}

function majority(total) {
  return Math.floor(total / 2) + 1;
}

function setLoadingVisible(visible) {
  document.getElementById('loading-screen').style.display = visible ? 'flex' : 'none';
  document.getElementById('app').style.display = visible ? 'none' : 'flex';
}

// ── UI Updates ────────────────────────────────────────────────────────────────
function updateEndUI() {
  const count = endVoters.size;
  const needed = majority(presenceCount);
  const pct = presenceCount > 0 ? Math.min((count / presenceCount) * 100, 100) : 0;

  document.getElementById('end-vote-count').textContent =
    `${count} of ${presenceCount} voted (${needed} needed)`;
  document.getElementById('end-progress-bar').style.width = pct + '%';

  const btn = document.getElementById('end-vote-btn');
  if (hasVotedEnd) {
    btn.disabled = true;
    btn.textContent = 'Vote Cast ✓';
  }
}

function updateRemoveUI() {
  const count = removeVoters.size;
  const needed = majority(presenceCount);
  const pct = presenceCount > 0 ? Math.min((count / presenceCount) * 100, 100) : 0;

  document.getElementById('remove-vote-count').textContent =
    `${count} of ${presenceCount} voted (${needed} needed)`;
  document.getElementById('remove-progress-bar').style.width = pct + '%';

  const btn = document.getElementById('remove-vote-btn');
  if (hasVotedRemove) {
    btn.disabled = true;
    btn.textContent = 'Vote Cast ✓';
  }
}

function updatePresenceUI() {
  document.getElementById('presence-count').textContent = presenceCount;
  // Recalculate quorum thresholds displayed
  updateEndUI();
  if (currentNomineeId) updateRemoveUI();
}

function showNomineeActive(nomineeId, nomineeName) {
  currentNomineeId = nomineeId;
  currentNomineeName = nomineeName;

  document.getElementById('nominate-area').style.display = 'none';
  document.getElementById('remove-vote-area').style.display = 'block';
  document.getElementById('nominee-display-name').textContent = nomineeName;
  document.getElementById('nominee-banner').style.display = 'flex';
  updateRemoveUI();
}

// ── Nominate UI helpers ───────────────────────────────────────────────────────
window.showNominateInput = function () {
  document.getElementById('nominate-btn').style.display = 'none';
  document.getElementById('nominate-input-wrap').style.display = 'flex';
  document.getElementById('nominee-name-input').focus();
};

window.cancelNomination = function () {
  document.getElementById('nominate-btn').style.display = 'block';
  document.getElementById('nominate-input-wrap').style.display = 'none';
  document.getElementById('nominee-name-input').value = '';
};

window.submitNomination = function () {
  const name = document.getElementById('nominee-name-input').value.trim();
  if (!name) return;
  nominateForRemoval(name);
  cancelNomination();
};

// ── Quorum Checks ─────────────────────────────────────────────────────────────
function checkEndQuorum() {
  if (meetingOverTriggered) return;
  if (endVoters.size >= majority(presenceCount)) {
    meetingOverTriggered = true;
    triggerMeetingOver();
  }
}

function checkRemoveQuorum() {
  if (removeQuorumTriggered) return;
  if (!currentNomineeId) return;
  if (removeVoters.size >= majority(presenceCount)) {
    removeQuorumTriggered = true;
    triggerHostAction();
  }
}

// ── End-meeting state ─────────────────────────────────────────────────────────
function triggerMeetingOver() {
  const overlay = document.getElementById('meeting-over-overlay');
  overlay.style.display = 'flex';
  startConfetti();
}

// ── Host-action state ─────────────────────────────────────────────────────────
function triggerHostAction() {
  document.getElementById('host-nominee-name').textContent = currentNomineeName || currentNomineeId;
  document.getElementById('host-action-banner').style.display = 'flex';
}

// ── Confetti ──────────────────────────────────────────────────────────────────
function startConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const COLORS = ['#6264A7', '#C239B3', '#E8A200', '#00BCF2', '#13A10E', '#FF4B00'];
  const PIECE_COUNT = 120;
  const pieces = [];

  for (let i = 0; i < PIECE_COUNT; i++) {
    pieces.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      w: 8 + Math.random() * 8,
      h: 4 + Math.random() * 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.15,
      vx: (Math.random() - 0.5) * 2,
      vy: 2 + Math.random() * 3,
    });
  }

  let frame = 0;
  const MAX_FRAMES = 300;

  function draw() {
    if (frame > MAX_FRAMES) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      ctx.save();
      ctx.translate(p.x + p.w / 2, p.y + p.h / 2);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();

      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;

      if (p.y > canvas.height) {
        p.y = -p.h;
        p.x = Math.random() * canvas.width;
      }
    });
    frame++;
    requestAnimationFrame(draw);
  }
  draw();
}

// ── Vote Actions ──────────────────────────────────────────────────────────────
window.castEndVote = async function () {
  if (hasVotedEnd) return;
  hasVotedEnd = true;
  endVoters.add(userId);
  updateEndUI();

  // Broadcast to peers
  channel.send({
    type: 'broadcast',
    event: 'vote_end',
    payload: { userId, meetingId },
  });

  // Persist to API
  try {
    await fetch('/api/votes/cast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingId, userId, voteType: 'end' }),
    });
  } catch (e) {
    console.warn('Quorum: API cast failed (non-fatal)', e);
  }

  checkEndQuorum();
};

function nominateForRemoval(name) {
  if (currentNomineeId) return; // already nominated
  const nomineeId = 'nominee-' + name.toLowerCase().replace(/\s+/g, '-');

  channel.send({
    type: 'broadcast',
    event: 'nominate',
    payload: { nomineeId, nomineeName: name, nominatorId: userId },
  });

  showNomineeActive(nomineeId, name);
}

window.castRemoveVote = async function () {
  if (hasVotedRemove || !currentNomineeId) return;
  hasVotedRemove = true;
  removeVoters.add(userId);
  updateRemoveUI();

  channel.send({
    type: 'broadcast',
    event: 'vote_remove',
    payload: { userId, meetingId, nomineeId: currentNomineeId },
  });

  try {
    await fetch('/api/votes/cast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        meetingId,
        userId,
        voteType: 'remove',
        nomineeId: currentNomineeId,
      }),
    });
  } catch (e) {
    console.warn('Quorum: API cast failed (non-fatal)', e);
  }

  checkRemoveQuorum();
};

// ── Realtime Channel ──────────────────────────────────────────────────────────
function setupRealtimeChannel() {
  channel = supabase.channel(`meeting:${meetingId}`, {
    config: { presence: { key: userId } },
  });

  // Presence — track who has the panel open
  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState();
    presenceCount = Math.max(Object.keys(state).length, 1);
    updatePresenceUI();
  });

  channel.on('presence', { event: 'join' }, () => {
    const state = channel.presenceState();
    presenceCount = Math.max(Object.keys(state).length, 1);
    updatePresenceUI();
  });

  channel.on('presence', { event: 'leave' }, () => {
    const state = channel.presenceState();
    presenceCount = Math.max(Object.keys(state).length, 1);
    updatePresenceUI();
  });

  // Broadcast — vote_end
  channel.on('broadcast', { event: 'vote_end' }, ({ payload }) => {
    if (!endVoters.has(payload.userId)) {
      endVoters.add(payload.userId);
      updateEndUI();
      checkEndQuorum();
    }
  });

  // Broadcast — nominate
  channel.on('broadcast', { event: 'nominate' }, ({ payload }) => {
    if (!currentNomineeId) {
      showNomineeActive(payload.nomineeId, payload.nomineeName);
    }
  });

  // Broadcast — vote_remove
  channel.on('broadcast', { event: 'vote_remove' }, ({ payload }) => {
    if (payload.nomineeId === currentNomineeId && !removeVoters.has(payload.userId)) {
      removeVoters.add(payload.userId);
      updateRemoveUI();
      checkRemoveQuorum();
    }
  });

  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({
        userId,
        displayName: userDisplayName,
        joinedAt: Date.now(),
      });
    }
  });
}

// ── Hydrate from API (late joiners) ───────────────────────────────────────────
async function hydrateState() {
  try {
    const res = await fetch(`/api/votes/state?meetingId=${encodeURIComponent(meetingId)}`);
    if (!res.ok) return;
    const data = await res.json();

    // End votes
    if (Array.isArray(data.endVotes)) {
      data.endVotes.forEach(id => endVoters.add(id));
      if (endVoters.has(userId)) hasVotedEnd = true;
    }

    // Active nominee
    if (data.nomineeId) {
      currentNomineeId = data.nomineeId;
      currentNomineeName = data.nomineeName || data.nomineeId;
      showNomineeActive(currentNomineeId, currentNomineeName);
    }

    // Remove votes
    if (data.removeVotes && typeof data.removeVotes === 'object') {
      const nomineeVotes = data.removeVotes[currentNomineeId];
      if (Array.isArray(nomineeVotes)) {
        nomineeVotes.forEach(id => removeVoters.add(id));
        if (removeVoters.has(userId)) hasVotedRemove = true;
      }
    }

    updateEndUI();
    if (currentNomineeId) updateRemoveUI();

    // Check quorum from hydrated state (in case we join late to a resolved meeting)
    checkEndQuorum();
    if (currentNomineeId) checkRemoveQuorum();
  } catch (e) {
    console.warn('Quorum: hydrateState failed (non-fatal)', e);
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  // Initialize Supabase (uses constants defined in index.html script block)
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  let context = null;

  try {
    await microsoftTeams.app.initialize();
    context = await microsoftTeams.app.getContext();
  } catch (e) {
    console.warn('Quorum: Teams SDK not available — running in dev mode', e);
  }

  if (context && context.meeting && context.meeting.id) {
    meetingId = context.meeting.id;
    userId = context.user?.id || randomId();
    userDisplayName = context.user?.displayName || 'Unknown';
  } else {
    // Dev / testing fallback
    meetingId = 'dev-meeting-' + (window.location.search.slice(1) || 'local');
    userId = randomId();
    userDisplayName = 'Dev User';
    console.info('Quorum: dev mode — meetingId:', meetingId, 'userId:', userId);
  }

  // Show the app
  setLoadingVisible(false);
  updateEndUI();

  // Connect realtime
  setupRealtimeChannel();

  // Hydrate existing votes (late joiners)
  await hydrateState();
}

// Kick off once DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
