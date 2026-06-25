const {
  Client, GatewayIntentBits, EmbedBuilder,
  ButtonBuilder, ButtonStyle, ActionRowBuilder,
  PermissionFlagsBits, REST, Routes,
} = require('discord.js');
const fs = require('fs');

const DATA_PATH = process.env.DATA_PATH || './bracket-data.json';

function loadData() {
  if (!fs.existsSync(DATA_PATH)) return { rounds: {}, votes: {}, results: {} };
  try { return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8')); }
  catch { return { rounds: {}, votes: {}, results: {} }; }
}
function saveData(data) { fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2)); }

// ─────────────────────────────────────────
// BUILD EMBED + BOUTONS (vue personnalisée par user)
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
    if (hasVoted) {
      statusLine += userVote === result ? '\n🎯 Tu avais bon !' : '\n❌ Tu t\'étais trompé.';
    }
  } else if (hasVoted) {
    statusLine = `\n✔️ Tu as voté : **${match.teams[userVote]}**`;
  } else if (match.closed) {
    statusLine = '\n🔒 Ce match est fermé aux votes.';
  }

  return new EmbedBuilder()
    .setTitle(`${round.name} — Match ${matchIndex + 1}/${total}`)
    .setDescription(`**${match.teams[0]}** 🆚 **${match.teams[1]}**\n\nQui va gagner ?${statusLine}`)
    .setColor(match.closed ? '#e74c3c' : '#3498db')
    .setImage(match.image || null)
    .setFooter({ text: `Match ${matchIndex + 1} sur ${total}` });
}

function buildMatchButtons(round, matchIndex, userId) {
  const data     = loadData();
  const match    = round.matches[matchIndex];
  const total    = round.matches.length;
  const userVote = data.votes[userId]?.[round.id]?.[match.id];
  const hasVoted = userVote !== undefined;
  const rows     = [];

  // Boutons de vote
  if (!match.closed) {
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`vote:${round.id}:${match.id}:0:${matchIndex}`)
        .setLabel(hasVoted && userVote === 0 ? `✔️ ${match.teams[0]}` : match.teams[0])
        .setStyle(hasVoted && userVote === 0 ? ButtonStyle.Success : ButtonStyle.Primary)
        .setDisabled(hasVoted),
      new ButtonBuilder()
        .setCustomId(`vote:${round.id}:${match.id}:1:${matchIndex}`)
        .setLabel(hasVoted && userVote === 1 ? `✔️ ${match.teams[1]}` : match.teams[1])
        .setStyle(hasVoted && userVote === 1 ? ButtonStyle.Success : ButtonStyle.Primary)
        .setDisabled(hasVoted),
    ));
  }

  // Navigation
  rows.push(new ActionRowBuilder().addComponents(
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
  ));

  return rows;
}

// ─────────────────────────────────────────
// EMBED PUBLIC (invitation à voter)
// ─────────────────────────────────────────
function buildPublicEmbed(round) {
  const total = round.matches.length;
  const matchList = round.matches.map((m, i) => `**${i + 1}.** ${m.teams[0]} 🆚 ${m.teams[1]}`).join('\n');
  return new EmbedBuilder()
    .setTitle(`📋 ${round.name} — Pronostics`)
    .setDescription(`${total} matchs à pronostiquer !\n\n${matchList}\n\nClique sur le bouton ci-dessous pour faire tes pronostics.`)
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
  const data  = loadData();
  const round = data.rounds[roundId];
  if (!round) return null;

  const results       = data.results[roundId] || {};
  const closedMatches = round.matches.filter(m => results[m.id] !== undefined);

  if (closedMatches.length === 0) {
    return new EmbedBuilder()
      .setTitle(`🏆 Classement — ${round.name}`)
      .setDescription('Aucun résultat enregistré pour le moment.')
      .setColor('#f1c40f');
  }

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
    if (correct + wrong > 0) scores[userId] = { correct, wrong };
  }

  const sorted = Object.entries(scores).sort(([, a], [, b]) => b.correct - a.correct || a.wrong - b.wrong);

  if (sorted.length === 0) {
    return new EmbedBuilder()
      .setTitle(`🏆 Classement — ${round.name}`)
      .setDescription('Aucun vote enregistré.')
      .setColor('#f1c40f');
  }

  const medals = ['🥇', '🥈', '🥉'];
  const lines  = sorted.map(([userId, s], i) => {
    const prefix = medals[i] || `**${i + 1}.**`;
    return `${prefix} <@${userId}> — **${s.correct}✅ ${s.wrong}❌** (${s.correct + s.wrong}/${closedMatches.length} votés)`;
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

    if (interaction.commandName === 'create-bracket') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator))
        return interaction.reply({ content: '❌ Réservé aux admins.', ephemeral: true });

      const roundName  = interaction.options.getString('nom');
      const channel    = interaction.options.getChannel('channel') || interaction.channel;
      const matches    = [];

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
      const round   = { id: roundId, name: roundName, matches, channelId: channel.id, messageId: null };

      const msg = await channel.send({
        embeds: [buildPublicEmbed(round)],
        components: [buildPublicButton(roundId)],
      });

      round.messageId = msg.id;
      const data = loadData();
      data.rounds[roundId] = round;
      saveData(data);

      return interaction.reply({ content: `✅ Bracket **${roundName}** créé avec ${matches.length} match(s) !\nID : \`${roundId}\``, ephemeral: true });
    }

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

      return interaction.reply({
        content: `✅ **${match.teams[winner]}** gagne le match ${matchNum + 1} de **${round.name}**.`,
        ephemeral: true
      });
    }

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

    // Ouvrir la vue personnelle (éphémère)
    if (action === 'open') {
      const roundId = parts[1];
      const data    = loadData();
      const round   = data.rounds[roundId];
      if (!round) return interaction.reply({ content: '❌ Bracket introuvable.', ephemeral: true });

      return interaction.reply({
        embeds: [buildMatchEmbed(round, 0, interaction.user.id)],
        components: buildMatchButtons(round, 0, interaction.user.id),
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
        return interaction.reply({ content: '❌ Vote irrévocable — tu as déjà voté sur ce match.', ephemeral: true });

      if (!data.votes[userId]) data.votes[userId] = {};
      if (!data.votes[userId][roundId]) data.votes[userId][roundId] = {};
      data.votes[userId][roundId][matchId] = teamIdx;
      saveData(data);

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
      const data   = loadData();
      const round  = data.rounds[roundId];
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
