const {
  Client, GatewayIntentBits, EmbedBuilder,
  ButtonBuilder, ButtonStyle, ActionRowBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const fs = require('fs');

const DATA_PATH   = process.env.DATA_PATH   || './bracket-data.json';
const BACKUP_PATH = process.env.BACKUP_PATH || './bracket-data-backup.json';

// ─────────────────────────────────────────
// DATA HELPERS
// ─────────────────────────────────────────
function loadData() {
  if (!fs.existsSync(DATA_PATH)) return { rounds: {}, votes: {}, results: {} };
  try { return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')); }
  catch { return { rounds: {}, votes: {}, results: {} }; }
}

function saveData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
  // Backup automatique à chaque sauvegarde
  fs.writeFileSync(BACKUP_PATH, JSON.stringify({ ...data, _backupAt: new Date().toISOString() }, null, 2));
}

// ─────────────────────────────────────────
// TROUVER LE PROCHAIN MATCH NON VOTÉ
// ─────────────────────────────────────────
function getNextUnvotedMatch(round, userId, fromIndex = 0) {
  const data = loadData();
  for (let i = fromIndex; i < round.matches.length; i++) {
    const match    = round.matches[i];
    const hasVoted = data.votes[userId]?.[round.id]?.[match.id] !== undefined;
    if (!hasVoted && !match.closed) return i;
  }
  return null; // tous votés ou fermés
}

// ─────────────────────────────────────────
// BUILD EMBED
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
    statusLine = `\n✅ Résultat : **${match.teams[result]}**`;
    if (hasVoted) statusLine += userVote === result ? '\n🎯 Tu avais bon !' : '\n❌ Tu t\'étais trompé.';
  } else if (match.closed) {
    statusLine = '\n🔒 Ce match est fermé aux votes.';
  } else if (hasVoted) {
    statusLine = `\n✔️ Tu as voté : **${match.teams[userVote]}**`;
  }

  const embed = new EmbedBuilder()
    .setTitle(`${round.name} — Match ${matchIndex + 1}/${total}`)
    .setDescription(`**${match.teams[0]}** 🆚 **${match.teams[1]}**\n\nQui va gagner ?${statusLine}`)
    .setColor(match.closed ? '#e74c3c' : '#3498db')
    .setFooter({ text: `Match ${matchIndex + 1} sur ${total}` });

  if (match.image) embed.setImage(match.image);
  return embed;
}

// ─────────────────────────────────────────
// BUILD BOUTONS (vote uniquement, pas de nav)
// ─────────────────────────────────────────
function buildMatchButtons(round, matchIndex, userId) {
  const data     = loadData();
  const match    = round.matches[matchIndex];
  const userVote = data.votes[userId]?.[round.id]?.[match.id];
  const hasVoted = userVote !== undefined;

  if (match.closed || hasVoted) return [];

  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`vote:${round.id}:${match.id}:0:${matchIndex}`)
      .setLabel(match.teams[0])
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`vote:${round.id}:${match.id}:1:${matchIndex}`)
      .setLabel(match.teams[1])
      .setStyle(ButtonStyle.Primary),
  )];
}

// ─────────────────────────────────────────
// EMBED RÉSUMÉ FINAL (tous les matchs votés)
// ─────────────────────────────────────────
function buildSummaryEmbed(round, userId) {
  const data  = loadData();
  const lines = round.matches.map((match, i) => {
    const userVote = data.votes[userId]?.[round.id]?.[match.id];
    const result   = data.results[round.id]?.[match.id];
    let icon = '⏳';
    if (userVote !== undefined) {
      if (result !== undefined) icon = userVote === result ? '🎯' : '❌';
      else icon = '✔️';
    } else if (match.closed) {
      icon = '🔒';
    }
    const voted = userVote !== undefined ? `**${match.teams[userVote]}**` : '*pas voté*';
    return `${icon} Match ${i + 1} : ${match.teams[0]} 🆚 ${match.teams[1]} → ${voted}`;
  });

  return new EmbedBuilder()
    .setTitle(`📋 ${round.name} — Tes pronostics`)
    .setDescription(lines.join('\n'))
    .setColor('#2ecc71')
    .setFooter({ text: 'Tous tes votes sont enregistrés !' });
}

// ─────────────────────────────────────────
// EMBED PUBLIC
// ─────────────────────────────────────────
function buildPublicEmbed(round) {
  const total     = round.matches.length;
  const closeDate = new Date(round.closeAt);
  const matchList = round.matches.map((m, i) => `**${i + 1}.** ${m.teams[0]} 🆚 ${m.teams[1]}`).join('\n');
  return new EmbedBuilder()
    .setTitle(`📋 ${round.name} — Pronostics`)
    .setDescription(`${total} matchs à pronostiquer !\n\n${matchList}\n\n⏰ Fermeture des votes : <t:${Math.floor(closeDate.getTime() / 1000)}:F>`)
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
    return new EmbedBuilder().setTitle(`🏆 Classement — ${round.name}`).setDescription('Aucun résultat enregistré.').setColor('#f1c40f');

  const scores = {};
  for (const [userId, roundVotes] of Object.entries(data.votes)) {
    const userRoundVotes = roundVotes[roundId] || {};
    let correct = 0, wrong = 0;
    for (const match of closedMatches) {
      const uv = userRoundVotes[match.id];
      if (uv === undefined) continue;
      if (uv === results[match.id]) correct++; else wrong++;
    }
    if (correct + wrong > 0) scores[userId] = { correct, wrong };
  }

  const sorted = Object.entries(scores).sort(([, a], [, b]) => b.correct - a.correct || a.wrong - b.wrong);
  if (sorted.length === 0)
    return new EmbedBuilder().setTitle(`🏆 Classement — ${round.name}`).setDescription('Aucun vote enregistré.').setColor('#f1c40f');

  const medals = ['🥇', '🥈', '🥉'];
  const lines  = sorted.map(([userId, s], i) =>
    `${medals[i] || `**${i + 1}.**`} <@${userId}> — **${s.correct}✅ ${s.wrong}❌** (${s.correct + s.wrong}/${closedMatches.length} votés)`
  );

  return new EmbedBuilder()
    .setTitle(`🏆 Classement — ${round.name}`)
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
    // Fermer tous les matchs qui n'ont pas encore de résultat
    d.rounds[roundId].matches.forEach(m => { if (!m.closed) m.closed = true; });
    saveData(d);
    console.log(`🔒 Round ${roundId} fermé automatiquement.`);

    // Mettre à jour le message public
    try {
      const r = d.rounds[roundId];
      const ch = await client.channels.fetch(r.channelId);
      const msg = await ch.messages.fetch(r.messageId);
      await msg.edit({
        embeds: [buildPublicEmbed(r).setColor('#e74c3c').setTitle(`🔴 ${r.name} — VOTES FERMÉS`)],
        components: [],
      });
    } catch {}
  }, delay);
}

// ─────────────────────────────────────────
// CLIENT
// ─────────────────────────────────────────
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.on('interactionCreate', async interaction => {

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
        const parts = val.split('/').map(t => t.trim());
        if (parts.length !== 2)
          return interaction.reply({ content: `❌ Format invalide pour match${i}. Utilise : \`Équipe A / Équipe B\``, ephemeral: true });
        const image = interaction.options.getString(`image${i}`) || null;
        matches.push({ id: `m${i}`, teams: parts, image, closed: false });
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
      data.rounds[roundId] = round;
      saveData(data);
      scheduleAutoClose(client, roundId);

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

      return interaction.reply({ content: `✅ **${match.teams[winner]}** gagne le match ${matchNum + 1} de **${round.name}**.`, ephemeral: true });
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

      return interaction.reply({ content: `🔒 Match ${matchNum + 1} (**${match.teams[0]}** 🆚 **${match.teams[1]}**) fermé manuellement.`, ephemeral: true });
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
        return interaction.reply({
          embeds: [buildSummaryEmbed(round, interaction.user.id)],
          ephemeral: true,
        });
      }

      return interaction.reply({
        embeds: [buildMatchEmbed(round, firstUnvoted, interaction.user.id)],
        components: buildMatchButtons(round, firstUnvoted, interaction.user.id),
        ephemeral: true,
      });
    }

    // Vote → passe automatiquement au suivant
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
        return interaction.reply({ content: '❌ Vote irrévocable — tu as déjà voté.', ephemeral: true });

      // Enregistrer le vote
      if (!data.votes[userId]) data.votes[userId] = {};
      if (!data.votes[userId][roundId]) data.votes[userId][roundId] = {};
      data.votes[userId][roundId][matchId] = teamIdx;
      saveData(data);

      // Trouver le prochain match non voté
      const nextIdx = getNextUnvotedMatch(round, userId, matchIdx + 1);

      if (nextIdx === null) {
        // Tous les matchs sont votés → afficher le résumé
        return interaction.update({
          embeds: [buildSummaryEmbed(round, userId)],
          components: [],
        });
      }

      // Passer au prochain match
      return interaction.update({
        embeds: [buildMatchEmbed(round, nextIdx, userId)],
        components: buildMatchButtons(round, nextIdx, userId),
      });
    }
  }
});

client.once('ready', () => {
  console.log(`🤖 Bot connecté : ${client.user.tag}`);
  // Reprogrammer les fermetures auto au démarrage
  const data = loadData();
  for (const [id, round] of Object.entries(data.rounds)) {
    if (!round.votesClosed && new Date(round.closeAt) > new Date()) {
      scheduleAutoClose(client, id);
      console.log(`⏰ Fermeture reprogrammée : ${id} à ${round.closeAt}`);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
