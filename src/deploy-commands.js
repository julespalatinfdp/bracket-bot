const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('create-bracket')
    .setDescription('Crée un bracket de pronostics (jusqu\'à 18 matchs)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('nom').setDescription('Nom du round (ex: 16es de finale)').setRequired(true))
    .addStringOption(o => o.setName('fermeture').setDescription('Date fermeture (ISO: 2026-06-28T18:00:00)').setRequired(true))
    .addStringOption(o => o.setName('matchs1').setDescription('Matchs 1-3 : France:3.3 / Espagne:1.5 | Brésil:2.1 / Maroc:3.8 | ...').setRequired(true))
    .addStringOption(o => o.setName('images1').setDescription('Images matchs 1-3 : url1 | url2 | url3').setRequired(false))
    .addStringOption(o => o.setName('matchs2').setDescription('Matchs 4-6 : Équipe:cote / Équipe:cote | ...').setRequired(false))
    .addStringOption(o => o.setName('images2').setDescription('Images matchs 4-6 : url1 | url2 | url3').setRequired(false))
    .addStringOption(o => o.setName('matchs3').setDescription('Matchs 7-9 : Équipe:cote / Équipe:cote | ...').setRequired(false))
    .addStringOption(o => o.setName('images3').setDescription('Images matchs 7-9 : url1 | url2 | url3').setRequired(false))
    .addStringOption(o => o.setName('matchs4').setDescription('Matchs 10-12 : Équipe:cote / Équipe:cote | ...').setRequired(false))
    .addStringOption(o => o.setName('images4').setDescription('Images matchs 10-12 : url1 | url2 | url3').setRequired(false))
    .addStringOption(o => o.setName('matchs5').setDescription('Matchs 13-15 : Équipe:cote / Équipe:cote | ...').setRequired(false))
    .addStringOption(o => o.setName('images5').setDescription('Images matchs 13-15 : url1 | url2 | url3').setRequired(false))
    .addStringOption(o => o.setName('matchs6').setDescription('Matchs 16-18 : Équipe:cote / Équipe:cote | ...').setRequired(false))
    .addStringOption(o => o.setName('images6').setDescription('Images matchs 16-18 : url1 | url2 | url3').setRequired(false))
    .addChannelOption(o => o.setName('channel').setDescription('Channel cible').addChannelTypes(ChannelType.GuildText).setRequired(false)),

  new SlashCommandBuilder()
    .setName('set-result')
    .setDescription('Enregistre le résultat d\'un match et crédite les gains')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('round_id').setDescription('ID du round').setRequired(true))
    .addIntegerOption(o => o.setName('match_numero').setDescription('Numéro du match (1, 2, 3...)').setRequired(true).setMinValue(1).setMaxValue(18))
    .addIntegerOption(o => o.setName('vainqueur').setDescription('Équipe gagnante').setRequired(true)
      .addChoices({ name: 'Équipe 1', value: 1 }, { name: 'Équipe 2', value: 2 })
    ),

  new SlashCommandBuilder()
    .setName('close-match')
    .setDescription('Ferme manuellement les votes d\'un match')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('round_id').setDescription('ID du round').setRequired(true))
    .addIntegerOption(o => o.setName('match_numero').setDescription('Numéro du match').setRequired(true).setMinValue(1).setMaxValue(18)),

  new SlashCommandBuilder()
    .setName('classement-bracket')
    .setDescription('Affiche le classement du bracket')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o => o.setName('round_id').setDescription('ID du round').setRequired(true)),

  new SlashCommandBuilder()
    .setName('solde-bracket')
    .setDescription('Affiche le solde bracket d\'un membre')
    .addUserOption(o => o.setName('user').setDescription('Membre (défaut : toi)').setRequired(false)),

].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('🔄 Déploiement des slash commands...');
    await rest.put(
      Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('✅ Slash commands déployées !');
  } catch (err) {
    console.error('❌ Erreur :', err);
    process.exit(1);
  }
})();
