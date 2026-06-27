const {
  Client, GatewayIntentBits, EmbedBuilder,
  ButtonBuilder, ButtonStyle, ActionRowBuilder,
  PermissionFlagsBits, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
} = require('discord.js');
const fs = require('fs');

const DATA_PATH        = process.env.DATA_PATH   || './bracket-data.json';
const BACKUP_PATH      = process.env.BACKUP_PATH || './bracket-data-backup.json';
const SCORES_PATH      = process.env.SCORES_PATH || './bracket-scores.json';
const ADMIN_LOG_CHANNEL = '1519978475119837202';

// ─────────────────────────────────────────
// DATA HELPERS
// ─────────────────────────────────────────
function loadData() {
  if (!fs.existsSync(DATA_PATH)) return { rounds: {}, votes: {}, results: {}, boosts: {} };
  try { return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')); }
  catch { return { rounds: {}, votes: {}, results: {}, boosts: {} }; }
}
function saveData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
  fs.writeFileSync(BACKUP_PATH, JSON.stringify({ ...data, _backupAt: new Date().toISOString() }, null, 2));
}

function loadScores() {
  if (!fs.existsSync(SCORES_PATH)) return {};
  try { return JSON.parse(fs.readFileSync(SCORES_PATH, 'utf8')); }
  catch { return {}; }
}
function saveScores(scores) { fs.writeFileSync(SCORES_PATH, JSON.stringify(scores, null, 2)); }
function creditScore(userId, amount) {
  const scores = loadScores();
  if (!scores[userId]) scores[userId] = 0;
  scores[userId] = Math.round((scores[userId] + amount) * 100) / 100;
  saveScores(scores);
}

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
function getNextUnvotedMatch(round, userId, fromIndex = 0) {
  const data = loadData();
  for (let i = fromIndex; i < round.matches.length; i++) {
    const match    = round.matches[i];
    const hasVoted = data.votes[userId]?.[round.id]?.[match.id] !== undefined;
    if (!hasVoted && !match.closed) return i;
  }
  return null;
}

function hasAllVoted(round, userId) {
  return getNextUnvotedMatch(round, userId, 0) === null;
}

// ─────────────────────────────────────────
// BUILD EMBED MATCH
// ─────────────────────────────────────────
function buildMatchEmbed(round, matchIndex, userId) {
  const data     = loadData();
  const match    = round.matches[matchIndex];
  const total    = round.matches.length;
  const userVote = data.votes[userId]?.[round.id]?.[match.id];
  const hasVoted = userVote !== undefined;
  const result   = data.results[round.id]?.[match.id];

  let statusLine = '';
  if (match.closed && result !== undefined) {
    statusLine = `\n✅ Résultat : **${match.teams[result].name}**`;
    if (hasVoted) statusLine += userVote === result ? '\n🎯 Tu avais bon !' : '\n❌ Tu t\'étais trompé.';
  } else if (match.closed) {
    statusLine = '\n🔒 Ce match est fermé aux votes.';
  } else if (hasVoted) {
    statusLine = `\n✔️ Tu as voté : **${match.teams[userVote].name}**`;
  }

  const oddsLine = `\n\n📊 Cotes : **${match.teams[0].name}** x${match.teams[0].odds} | **${match.teams[1].name}** x${match.teams[1].odds}`;

  const embed = new EmbedBuilder()
    .setTitle(`${round.name} - Match ${matchIndex + 1}/${total}`)
    .setDescription(`**${match.teams[0].name}** 🆚 **${match.teams[1].name}**\n\nQui va gagner ?${oddsLine}${statusLine}`)
    .setColor(match.closed ? '#e74c3c' : '#3498db')
    .setFooter({ text: `Match ${matchIndex + 1} sur ${total}` });

  if (match.image) embed.setImage(match.image);
  return embed;
}

function buildMatchButtons(round, matchIndex) {
  const match = round.matches[matchIndex];
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`vote:${round.id}:${match.id}:0:${matchIndex}`)
      .setLabel(`${match.teams[0].name} (x${match.teams[0].odds})`)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`vote:${round.id}:${match.id}:1:${matchIndex}`)
      .setLabel(`${match.teams[1].name} (x${match.teams[1].odds})`)
      .setStyle(ButtonStyle.Primary),
  )];
}

// ─────────────────────────────────────────
// RÉSUMÉ + BOOST
// ─────────────────────────────────────────
function buildSummaryEmbed(round, userId) {
  const data   = loadData();
  const boost  = data.boosts?.[userId]?.[round.id];
  const scores = loadScores();
  const total  = scores[userId] ?? 0;

  const lines = round.matches.map((match, i) => {
    const userVote = data.votes[userId]?.[round.id]?.[match.id];
    const result   = data.results[round.id]?.[match.id];
    const isBoost  = boost === match.id;
    let icon = '⏳';
    if (userVote !== undefined) {
      if (result !== undefined) icon = userVote === result ? '🎯' : '❌';
      else icon = '✔️';
    } else if (match.closed) icon = '🔒';
    const voted  = userVote !== undefined ? `**${match.teams[userVote].name}** (x${match.teams[userVote].odds}${isBoost ? ' ⚡x2' : ''})` : '*pas voté*';
    return `${icon} Match ${i + 1} : ${match.teams[0].name} 🆚 ${match.teams[1].name} - ${voted}`;
  });

  return new EmbedBuilder()
    .setTitle(`📋 ${round.name} - Tes pronostics`)
    .setDescription(lines.join('\n') + `\n\n⚡ Total de points : **${total} pts**`)
    .setColor('#2ecc71')
    .setFooter({ text: boost ? '⚡ Boost activé !' : '💡 Tu as un boost disponible — utilise-le ci-dessous !' });
}

function buildBoostSelect(round, userId) {
  const data  = loadData();
  const votes = data.votes[userId]?.[round.id] || {};

  const options = round.matches
    .map((match, i) => {
      const userVote = votes[match.id];
      if (userVote === undefined) return null;
      return new StringSelectMenuOptionBuilder()
        .setValue(`${round.id}:${match.id}`)
        .setLabel(`Match ${i + 1} : ${match.teams[userVote].name} (x${match.teams[userVote].odds} → x${(match.teams[userVote].odds * 2).toFixed(1)})`);
    })
    .filter(Boolean);

  if (options.length === 0) return null;

  const select = new StringSelectMenuBuilder()
    .setCustomId(`boost_select:${round.id}`)
    .setPlaceholder('⚡ Choisis le pronostic à booster - gain x2 si tu as bon')
    .addOptions(options);

  return new ActionRowBuilder().addComponents(select);
}

// ─────────────────────────────────────────
// EMBED PUBLIC
// ─────────────────────────────────────────
function buildPublicEmbed(round) {
  const closeDate = new Date(round.closeAt);
  const matchList = round.matches.map((m, i) =>
    `**${i + 1}.** ${m.teams[0].name} (x${m.teams[0].odds}) 🆚 ${m.teams[1].name} (x${m.teams[1].odds})`
  ).join('\n');
  return new EmbedBuilder()
    .setTitle(`📋 ${round.name} - Pronostics`)
    .setDescription(`${round.matches.length} matchs a pronostiquer !\n\n${matchList}\n\n⏰ Fermeture des votes : <t:${Math.floor(closeDate.getTime() / 1000)}:F>`)
    .setColor('#3498db');
}

function buildPublicButton(roundId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`open:${roundId}`)
      .setLabel('🎯 Faire mes pronostics')
      .setStyle(ButtonStyle.Primary)
  );
}

// ─────────────────────────────────────────
// CLASSEMENT
// ─────────────────────────────────────────
function buildClassementEmbed(roundId) {
  const data          = loadData();
  const round         = data.rounds[roundId];
  if (!round) return null;
  const results       = data.results[roundId] || {};
  const closedMatches = round.matches.filter(m => results[m.id] !== undefined);
  if (closedMatches.length === 0)
    return new EmbedBuilder().setTitle(`🏆 Classement - ${round.name}`).setDescription('Aucun résultat enregistré.').setColor('#f1c40f');

  // Calculer les gains de chaque joueur
  const gains = {};
  for (const [userId, roundVotes] of Object.entries(data.votes)) {
    const userVotes = roundVotes[roundId] || {};
    const boost     = data.boosts?.[userId]?.[roundId];
    let total = 0, correct = 0, wrong = 0;
    for (const match of closedMatches) {
      const uv = userVotes[match.id];
      if (uv === undefined) continue;
      if (uv === results[match.id]) {
        correct++;
        let pts = match.teams[uv].odds;
        if (boost === match.id) pts *= 2;
        total += pts;
      } else {
        wrong++;
      }
    }
    if (correct + wrong > 0) gains[userId] = { correct, wrong, total: Math.round(total * 100) / 100 };
  }

  const sorted = Object.entries(gains).sort(([, a], [, b]) => b.total - a.total);
  if (sorted.length === 0)
    return new EmbedBuilder().setTitle(`🏆 Classement - ${round.name}`).setDescription('Aucun vote enregistré.').setColor('#f1c40f');

  const medals = ['🥇', '🥈', '🥉'];
  const lines  = sorted.map(([userId, s], i) =>
    `${medals[i] || `**${i + 1}.**`} <@${userId}> - **${s.total} pts** (${s.correct}✅ ${s.wrong}❌)`
  );

  return new EmbedBuilder()
    .setTitle(`🏆 Classement - ${round.name}`)
    .setDescription(lines.join('\n'))
    .setColor('#f1c40f')
    .setFooter({ text: `${closedMatches.length}/${round.matches.length} matchs avec résultats` });
}

// ─────────────────────────────────────────
// AUTO-CLOSE
// ─────────────────────────────────────────
function scheduleAutoClose(client, roundId) {
  const data  = loadData();
  const round = data.rounds[roundId];
  if (!round || round.votesClosed) return;
  const delay = new Date(round.closeAt).getTime() - Date.now();
  if (delay <= 0) return;
  setTimeout(async () => {
    const d = loadData();
    if (!d.rounds[roundId] || d.rounds[roundId].votesClosed) return;
    d.rounds[roundId].votesClosed = true;
    d.rounds[roundId].matches.forEach(m => { if (!m.closed) m.closed = true; });
    saveData(d);
    console.log(`🔒 Round ${roundId} fermé automatiquement.`);
    try {
      const r   = d.rounds[roundId];
      const ch  = await client.channels.fetch(r.channelId);
      const msg = await ch.messages.fetch(r.messageId);
      await msg.edit({
        embeds: [buildPublicEmbed(r).setColor('#e74c3c').setTitle(`🔴 ${r.name} - VOTES FERMÉS`)],
        components: [],
      });
    } catch {}
  }, delay);
}

// ─────────────────────────────────────────
// CRÉDITER LES GAINS APRÈS SET-RESULT
// ─────────────────────────────────────────
function creditMatchGains(roundId, matchId) {
  const data   = loadData();
  const round  = data.rounds[roundId];
  const result = data.results[roundId]?.[matchId];
  if (result === undefined || !round) return;

  const match = round.matches.find(m => m.id === matchId);
  if (!match) return;

  for (const [userId, roundVotes] of Object.entries(data.votes)) {
    const uv    = roundVotes[roundId]?.[matchId];
    const boost = data.boosts?.[userId]?.[roundId];
    if (uv === undefined || uv !== result) continue;
    let pts = match.teams[uv].odds;
    if (boost === matchId) pts *= 2;
    creditScore(userId, pts);
  }
}

// ─────────────────────────────────────────
// CLIENT
// ─────────────────────────────────────────
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.on('interactionCreate', async interaction => {

  // ── SLASH COMMANDS ───────────────────────
  if (interaction.isChatInputCommand()) {

    // /create-bracket
    if (interaction.commandName === 'create-bracket') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
        return interaction.reply({ content: '❌ Réservé aux admins.', ephemeral: true });

      const roundName = interaction.options.getString('nom');
      const closeAt   = interaction.options.getString('fermeture');
      const channel   = interaction.options.getChannel('channel') || interaction.channel;
      const closeDate = new Date(closeAt);

      if (isNaN(closeDate.getTime()) || closeDate <= new Date())
        return interaction.reply({ content: '❌ Date invalide. Format : `2026-06-28T18:00:00`', ephemeral: true });

      const matches = [];
      for (let i = 1; i <= 8; i++) {
        const val = interaction.options.getString(`match${i}`);
        if (!val) break;
        // Format : "France:3.3 / Espagne:1.5"
        const sides = val.split('/').map(s => s.trim());
        if (sides.length !== 2)
          return interaction.reply({ content: `❌ Format invalide pour match${i}. Utilise : \`France:3.3 / Espagne:1.5\``, ephemeral: true });
        const parseTeam = (s) => {
          const idx = s.lastIndexOf(':');
          if (idx === -1) return null;
          const name = s.slice(0, idx).trim();
          const odds = parseFloat(s.slice(idx + 1).trim());
          if (!name || isNaN(odds)) return null;
          return { name, odds };
        };
        const t0 = parseTeam(sides[0]);
        const t1 = parseTeam(sides[1]);
        if (!t0 || !t1)
          return interaction.reply({ content: `❌ Format invalide pour match${i}. Utilise : \`France:3.3 / Espagne:1.5\``, ephemeral: true });
        const image = interaction.options.getString(`image${i}`) || null;
        matches.push({ id: `m${i}`, teams: [t0, t1], image, closed: false });
      }

      if (matches.length === 0)
        return interaction.reply({ content: '❌ Ajoute au moins un match.', ephemeral: true });

      const roundId = `round_${Date.now()}`;
      const round   = { id: roundId, name: roundName, matches, closeAt: closeDate.toISOString(), votesClosed: false, channelId: channel.id, messageId: null };

      const msg = await channel.send({
        embeds: [buildPublicEmbed(round)],
        components: [buildPublicButton(roundId)],
      });

      round.messageId = msg.id;
      const data = loadData();
      if (!data.boosts) data.boosts = {};
      data.rounds[roundId] = round;
      saveData(data);
      scheduleAutoClose(client, roundId);

      try {
        const logCh = await client.channels.fetch(ADMIN_LOG_CHANNEL);
        await logCh.send({ embeds: [new EmbedBuilder()
          .setTitle('📋 Nouveau bracket créé')
          .setDescription(`**Nom :** ${roundName}\n**ID :** \`${roundId}\`\n**Fermeture :** <t:${Math.floor(closeDate.getTime() / 1000)}:F>\n**Channel :** <#${channel.id}>\n**Matchs :** ${matches.length}`)
          .setColor('#3498db')] });
      } catch (e) { console.error('❌ Erreur log admin :', e.message); }

      return interaction.reply({ content: `✅ Bracket **${roundName}** créé ! ID : \`${roundId}\`\nFermeture : <t:${Math.floor(closeDate.getTime() / 1000)}:F>`, ephemeral: true });
    }

    // /set-result
    if (interaction.commandName === 'set-result') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
        return interaction.reply({ content: '❌ Réservé aux admins.', ephemeral: true });

      const roundId  = interaction.options.getString('round_id');
      const matchNum = interaction.options.getInteger('match_numero') - 1;
      const winner   = interaction.options.getInteger('vainqueur') - 1;
      const data     = loadData();
      const round    = data.rounds[roundId];
      if (!round) return interaction.reply({ content: `❌ Round \`${roundId}\` introuvable.`, ephemeral: true });
      const match = round.matches[matchNum];
      if (!match) return interaction.reply({ content: `❌ Match ${matchNum + 1} introuvable.`, ephemeral: true });

      if (!data.results[roundId]) data.results[roundId] = {};
      data.results[roundId][match.id] = winner;
      round.matches[matchNum].closed  = true;
      saveData(data);
      creditMatchGains(roundId, match.id);

      return interaction.reply({ content: `✅ **${match.teams[winner].name}** gagne le match ${matchNum + 1} de **${round.name}**. Gains crédités !`, ephemeral: true });
    }

    // /close-match
    if (interaction.commandName === 'close-match') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
        return interaction.reply({ content: '❌ Réservé aux admins.', ephemeral: true });

      const roundId  = interaction.options.getString('round_id');
      const matchNum = interaction.options.getInteger('match_numero') - 1;
      const data     = loadData();
      const round    = data.rounds[roundId];
      if (!round) return interaction.reply({ content: `❌ Round \`${roundId}\` introuvable.`, ephemeral: true });
      const match = round.matches[matchNum];
      if (!match) return interaction.reply({ content: `❌ Match ${matchNum + 1} introuvable.`, ephemeral: true });

      round.matches[matchNum].closed = true;
      saveData(data);
      return interaction.reply({ content: `🔒 Match ${matchNum + 1} (**${match.teams[0].name}** 🆚 **${match.teams[1].name}**) fermé manuellement.`, ephemeral: true });
    }

    // /classement-bracket
    if (interaction.commandName === 'classement-bracket') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages))
        return interaction.reply({ content: '❌ Réservé aux modérateurs.', ephemeral: true });

      const roundId = interaction.options.getString('round_id');
      const embed   = buildClassementEmbed(roundId);
      if (!embed) return interaction.reply({ content: `❌ Round \`${roundId}\` introuvable.`, ephemeral: true });

      await interaction.channel.send({ embeds: [embed] });
      return interaction.reply({ content: '✅ Classement posté.', ephemeral: true });
    }

    // /solde-bracket
    if (interaction.commandName === 'solde-bracket') {
      const target = interaction.options.getUser('user') || interaction.user;
      const scores = loadScores();
      const pts    = scores[target.id] ?? 0;
      return interaction.reply({ content: `💰 Solde bracket de <@${target.id}> : **${pts} pts**`, ephemeral: true });
    }
  }

  // ── BOUTONS ──────────────────────────────
  if (interaction.isButton()) {
    const parts  = interaction.customId.split(':');
    const action = parts[0];

    // Ouvrir vue personnelle
    if (action === 'open') {
      const roundId = parts[1];
      const data    = loadData();
      const round   = data.rounds[roundId];
      if (!round) return interaction.reply({ content: '❌ Bracket introuvable.', ephemeral: true });
      if (round.votesClosed)
        return interaction.reply({ content: '🔴 Les votes sont fermés pour ce round.', ephemeral: true });

      const firstUnvoted = getNextUnvotedMatch(round, interaction.user.id, 0);
      if (firstUnvoted === null) {
        const boost     = data.boosts?.[interaction.user.id]?.[roundId];
        const boostRow  = !boost ? buildBoostSelect(round, interaction.user.id) : null;
        const components = boostRow ? [boostRow] : [];
        return interaction.reply({
          embeds: [buildSummaryEmbed(round, interaction.user.id)],
          components,
          ephemeral: true,
        });
      }

      return interaction.reply({
        embeds: [buildMatchEmbed(round, firstUnvoted, interaction.user.id)],
        components: buildMatchButtons(round, firstUnvoted),
        ephemeral: true,
      });
    }

    // Vote
    if (action === 'vote') {
      const [, roundId, matchId, teamIdxStr, matchIdxStr] = parts;
      const teamIdx  = parseInt(teamIdxStr);
      const matchIdx = parseInt(matchIdxStr);
      const userId   = interaction.user.id;
      const data     = loadData();
      const round    = data.rounds[roundId];
      if (!round) return interaction.reply({ content: '❌ Round introuvable.', ephemeral: true });

      const match = round.matches[matchIdx];
      if (match.closed) return interaction.reply({ content: '🔒 Ce match est fermé.', ephemeral: true });
      if (data.votes[userId]?.[roundId]?.[matchId] !== undefined)
        return interaction.reply({ content: '❌ Vote irrévocable, tu as déjà voté.', ephemeral: true });

      if (!data.votes[userId]) data.votes[userId] = {};
      if (!data.votes[userId][roundId]) data.votes[userId][roundId] = {};
      data.votes[userId][roundId][matchId] = teamIdx;
      saveData(data);

      const nextIdx = getNextUnvotedMatch(round, userId, matchIdx + 1);
      if (nextIdx === null) {
        // Tous votés : afficher résumé + select boost si pas encore utilisé
        const boost    = data.boosts?.[userId]?.[roundId];
        const boostRow = !boost ? buildBoostSelect(round, userId) : null;
        return interaction.update({
          embeds: [buildSummaryEmbed(round, userId)],
          components: boostRow ? [boostRow] : [],
        });
      }

      return interaction.update({
        embeds: [buildMatchEmbed(round, nextIdx, userId)],
        components: buildMatchButtons(round, nextIdx),
      });
    }
  }

  // ── SELECT MENU BOOST ────────────────────
  if (interaction.isStringSelectMenu()) {
    const parts  = interaction.customId.split(':');
    const action = parts[0];

    if (action === 'boost_select') {
      const roundId = parts[1];
      const [, matchId] = interaction.values[0].split(':');
      const userId  = interaction.user.id;
      const data    = loadData();
      const round   = data.rounds[roundId];
      if (!round) return interaction.reply({ content: '❌ Round introuvable.', ephemeral: true });

      if (data.boosts?.[userId]?.[roundId])
        return interaction.reply({ content: '❌ Tu as déjà utilisé ton boost sur ce bracket.', ephemeral: true });

      if (!data.boosts) data.boosts = {};
      if (!data.boosts[userId]) data.boosts[userId] = {};
      data.boosts[userId][roundId] = matchId;
      saveData(data);

      const match    = round.matches.find(m => m.id === matchId);
      const userVote = data.votes[userId][roundId][matchId];

      return interaction.update({
        embeds: [buildSummaryEmbed(round, userId)
          .setFooter({ text: `⚡ Boost activé sur ${match.teams[userVote].name} !` })],
        components: [],
      });
    }
  }
});

client.once('ready', () => {
  console.log(`🤖 Bot connecté : ${client.user.tag}`);
  const data = loadData();
  for (const [id, round] of Object.entries(data.rounds)) {
    if (!round.votesClosed && new Date(round.closeAt) > new Date()) {
      scheduleAutoClose(client, id);
      console.log(`⏰ Fermeture reprogrammée : ${id}`);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
