const {
  Client, GatewayIntentBits, EmbedBuilder,
  ButtonBuilder, ButtonStyle, ActionRowBuilder,
  PermissionFlagsBits, REST, Routes,
} = require('discord.js');
const fs = require('fs');

// ─────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────
const DATA_PATH = process.env.DATA_PATH || './bracket-data.json';

// ─────────────────────────────────────────
// DATA HELPERS
// ─────────────────────────────────────────
function loadData() {
  if (!fs.existsSync(DATA_PATH)) return { rounds: {}, votes: {}, results: {} };
  try { return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')); }
  catch { return { rounds: {}, votes: {}, results: {} }; }
}
function saveData(data) { fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2)); }

// ─────────────────────────────────────────
// BUILD EMBED POUR UN MATCH
// rounds[roundId] = { name, matches: [{id, team1, team2, closed}], messageId, channelId }
// votes[userId][roundId][matchId] = teamIndex (0 ou 1)
// results[roundId][matchId] = teamIndex (0 ou 1)
// ─────────────────────────────────────────
function buildMatchEmbed(round, matchIndex, userId) {
  const data    = loadData();
  const match   = round.matches[matchIndex];
  const total   = round.matches.length;
  const userVote = data.votes[userId]?.[round.id]?.[match.id];
  const hasVoted = userVote !== undefined;
  const result   = data.results[round.id]?.[match.id];

  let statusLine = '';
  if (match.closed && result !== undefined) {
    statusLine = `\n✅ Résultat : **${match.teams[result]}**`;
    if (hasVoted) {
      statusLine += userVote === result ? '\n🎯 Tu avais bon !' : '\n❌ Tu t\'étais trompé.';
    }
  } else if (hasVoted) {
    statusLine = `\n✔️ Tu as voté : **${match.teams[userVote]}**`;
  } else if (match.closed) {
    statusLine = '\n🔒 Ce match est fermé.';
  }

  return new EmbedBuilder()
    .setTitle(`${round.name} — Match ${matchIndex + 1}/${total}`)
    .setDescription(
      `**${match.teams[0]}** 🆚 **${match.teams[1]}**\n` +
      `\nQui va gagner ?${statusLine}`
    )
    .setColor(match.closed ? '#e74c3c' : '#3498db')
    .setFooter({ text: `Match ${matchIndex + 1} sur ${total}` });
}

function buildMatchButtons(round, matchIndex, userId) {
  const data    = loadData();
  const match   = round.matches[matchIndex];
  const total   = round.matches.length;
  const userVote = data.votes[userId]?.[round.id]?.[match.id];
  const hasVoted = userVote !== undefined;
  const voted0   = hasVoted && userVote === 0;
  const voted1   = hasVoted && userVote === 1;

  const rows = [];

  // Boutons de vote (si pas fermé)
  if (!match.closed) {
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`vote:${round.id}:${match.id}:0:${matchIndex}`)
        .setLabel(voted0 ? `✔️ ${match.teams[0]}` : match.teams[0])
        .setStyle(voted0 ? ButtonStyle.Success : ButtonStyle.Primary)
        .setDisabled(hasVoted),
      new ButtonBuilder()
        .setCustomId(`vote:${round.id}:${match.id}:1:${matchIndex}`)
        .setLabel(voted1 ? `✔️ ${match.teams[1]}` : match.teams[1])
        .setStyle(voted1 ? ButtonStyle.Success : ButtonStyle.Primary)
        .setDisabled(hasVoted),
    ));
  }

  // Boutons navigation
  const navRow = new ActionRowBuilder();
  navRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`nav:${round.id}:${matchIndex - 1}`)
      .setLabel('◀ Précédent')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(matchIndex === 0),
    new ButtonBuilder()
      .setCustomId(`nav:${round.id}:${matchIndex + 1}`)
      .setLabel('Suivant ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(matchIndex === total - 1),
  );
  rows.push(navRow);

  return rows;
}

// ─────────────────────────────────────────
// CLASSEMENT
// ─────────────────────────────────────────
function buildClassementEmbed(roundId) {
  const data  = loadData();
  const round = data.rounds[roundId];
  if (!round) return null;

  const results = data.results[roundId] || {};
  const closedMatches = round.matches.filter(m => results[m.id] !== undefined);
  if (closedMatches.length === 0) {
    return new EmbedBuilder()
      .setTitle(`🏆 Classement — ${round.name}`)
      .setDescription('Aucun résultat enregistré pour le moment.')
      .setColor('#f1c40f');
  }

  // Calculer le score de chaque votant
  const scores = {};
  for (const [userId, roundVotes] of Object.entries(data.votes)) {
    const userRoundVotes = roundVotes[roundId] || {};
    let correct = 0, wrong = 0;
    for (const match of closedMatches) {
      const userVote = userRoundVotes[match.id];
      const result   = results[match.id];
      if (userVote === undefined) continue;
      if (userVote === result) correct++;
      else wrong++;
    }
    scores[userId] = { correct, wrong, total: correct + wrong };
  }

  const sorted = Object.entries(scores)
    .filter(([, s]) => s.total > 0)
    .sort(([, a], [, b]) => b.correct - a.correct || a.wrong - b.wrong);

  if (sorted.length === 0) {
    return new EmbedBuilder()
      .setTitle(`🏆 Classement — ${round.name}`)
      .setDescription('Aucun vote enregistré.')
      .setColor('#f1c40f');
  }

  const medals = ['🥇', '🥈', '🥉'];
  const lines = sorted.map(([userId, s], i) => {
    const prefix = medals[i] || `**${i + 1}.**`;
    return `${prefix} <@${userId}> — **${s.correct}✅ / ${s.wrong}❌** (${s.total}/${closedMatches.length} matchs votés)`;
  });

  return new EmbedBuilder()
    .setTitle(`🏆 Classement — ${round.name}`)
    .setDescription(lines.join('\n'))
    .setColor('#f1c40f')
    .setFooter({ text: `${closedMatches.length}/${round.matches.length} matchs avec résultats` });
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
      const channel   = interaction.options.getChannel('channel') || interaction.channel;
      const matchesRaw = [];

      for (let i = 1; i <= 8; i++) {
        const val = interaction.options.getString(`match${i}`);
        if (!val) break;
        const parts = val.split('/').map(t => t.trim());
        if (parts.length !== 2) return interaction.reply({ content: `❌ Format invalide pour match${i}. Utilise : \`Équipe A / Équipe B\``, ephemeral: true });
        matchesRaw.push({ id: `m${i}`, teams: parts, closed: false });
      }

      if (matchesRaw.length === 0)
        return interaction.reply({ content: '❌ Ajoute au moins un match.', ephemeral: true });

      const roundId = `round_${Date.now()}`;
      const round = { id: roundId, name: roundName, matches: matchesRaw, channelId: channel.id, messageId: null };

      // Poster le premier match
      const msg = await channel.send({
        embeds: [buildMatchEmbed(round, 0, interaction.user.id)],
        components: buildMatchButtons(round, 0, interaction.user.id),
      });

      round.messageId = msg.id;
      const data = loadData();
      data.rounds[roundId] = round;
      saveData(data);

      return interaction.reply({ content: `✅ Bracket **${roundName}** créé avec ${matchesRaw.length} match(s) ! ID : \`${roundId}\``, ephemeral: true });
    }

    // /set-result
    if (interaction.commandName === 'set-result') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
        return interaction.reply({ content: '❌ Réservé aux admins.', ephemeral: true });

      const roundId   = interaction.options.getString('round_id');
      const matchNum  = interaction.options.getInteger('match_numero') - 1;
      const winner    = interaction.options.getInteger('vainqueur') - 1;

      const data  = loadData();
      const round = data.rounds[roundId];
      if (!round) return interaction.reply({ content: `❌ Round \`${roundId}\` introuvable.`, ephemeral: true });
      if (!round.matches[matchNum]) return interaction.reply({ content: `❌ Match ${matchNum + 1} introuvable.`, ephemeral: true });

      if (!data.results[roundId]) data.results[roundId] = {};
      const match = round.matches[matchNum];
      data.results[roundId][match.id] = winner;
      round.matches[matchNum].closed = true;
      saveData(data);

      return interaction.reply({
        content: `✅ Résultat enregistré : **${match.teams[winner]}** gagne le match ${matchNum + 1} de **${round.name}**.`,
        ephemeral: true
      });
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

    // /post-bracket
    if (interaction.commandName === 'post-bracket') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
        return interaction.reply({ content: '❌ Réservé aux admins.', ephemeral: true });

      const roundId = interaction.options.getString('round_id');
      const channel = interaction.options.getChannel('channel') || interaction.channel;
      const data    = loadData();
      const round   = data.rounds[roundId];
      if (!round) return interaction.reply({ content: `❌ Round \`${roundId}\` introuvable.`, ephemeral: true });

      const msg = await channel.send({
        embeds: [buildMatchEmbed(round, 0, interaction.user.id)],
        components: buildMatchButtons(round, 0, interaction.user.id),
      });

      round.messageId = msg.id;
      round.channelId = channel.id;
      saveData(data);

      return interaction.reply({ content: `✅ Bracket reposté dans <#${channel.id}>.`, ephemeral: true });
    }
  }

  // ── BOUTONS ──────────────────────────────
  if (interaction.isButton()) {
    const parts  = interaction.customId.split(':');
    const action = parts[0];

    // Vote
    if (action === 'vote') {
      const [, roundId, matchId, teamIdxStr, matchIdxStr] = parts;
      const teamIdx  = parseInt(teamIdxStr);
      const matchIdx = parseInt(matchIdxStr);
      const userId   = interaction.user.id;

      const data  = loadData();
      const round = data.rounds[roundId];
      if (!round) return interaction.reply({ content: '❌ Round introuvable.', ephemeral: true });

      const match = round.matches[matchIdx];
      if (match.closed) return interaction.reply({ content: '🔒 Ce match est fermé.', ephemeral: true });

      // Vérifier si déjà voté
      if (data.votes[userId]?.[roundId]?.[matchId] !== undefined)
        return interaction.reply({ content: '❌ Tu as déjà voté sur ce match. Le vote est irrévocable.', ephemeral: true });

      // Enregistrer le vote
      if (!data.votes[userId]) data.votes[userId] = {};
      if (!data.votes[userId][roundId]) data.votes[userId][roundId] = {};
      data.votes[userId][roundId][matchId] = teamIdx;
      saveData(data);

      // Mettre à jour l'embed (ephemeral pour ce user)
      return interaction.update({
        embeds: [buildMatchEmbed(round, matchIdx, userId)],
        components: buildMatchButtons(round, matchIdx, userId),
      });
    }

    // Navigation
    if (action === 'nav') {
      const [, roundId, newIdxStr] = parts;
      const newIdx = parseInt(newIdxStr);
      const userId = interaction.user.id;

      const data  = loadData();
      const round = data.rounds[roundId];
      if (!round) return interaction.reply({ content: '❌ Round introuvable.', ephemeral: true });
      if (newIdx < 0 || newIdx >= round.matches.length)
        return interaction.reply({ content: '❌ Match introuvable.', ephemeral: true });

      return interaction.update({
        embeds: [buildMatchEmbed(round, newIdx, userId)],
        components: buildMatchButtons(round, newIdx, userId),
      });
    }
  }
});

client.once('ready', () => {
  console.log(`🤖 Bot connecté : ${client.user.tag}`);
});

client.login(process.env.DISCORD_TOKEN);
