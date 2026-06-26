const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('create-bracket')
    .setDescription('Crée un bracket de pronostics avec cotes')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('nom').setDescription('Nom du round (ex: 16es de finale)').setRequired(true))
    .addStringOption(o => o.setName('fermeture').setDescription('Date/heure fermeture (ISO: 2026-06-28T18:00:00)').setRequired(true))
    .addStringOption(o => o.setName('match1').setDescription('Match 1 : France:3.3 / Espagne:1.5').setRequired(true))
    .addStringOption(o => o.setName('image1').setDescription('Image match 1 (URL)').setRequired(false))
    .addStringOption(o => o.setName('match2').setDescription('Match 2 : Équipe A:cote / Équipe B:cote').setRequired(false))
    .addStringOption(o => o.setName('image2').setDescription('Image match 2 (URL)').setRequired(false))
    .addStringOption(o => o.setName('match3').setDescription('Match 3 : Équipe A:cote / Équipe B:cote').setRequired(false))
    .addStringOption(o => o.setName('image3').setDescription('Image match 3 (URL)').setRequired(false))
    .addStringOption(o => o.setName('match4').setDescription('Match 4 : Équipe A:cote / Équipe B:cote').setRequired(false))
    .addStringOption(o => o.setName('image4').setDescription('Image match 4 (URL)').setRequired(false))
    .addStringOption(o => o.setName('match5').setDescription('Match 5 : Équipe A:cote / Équipe B:cote').setRequired(false))
    .addStringOption(o => o.setName('image5').setDescription('Image match 5 (URL)').setRequired(false))
    .addStringOption(o => o.setName('match6').setDescription('Match 6 : Équipe A:cote / Équipe B:cote').setRequired(false))
    .addStringOption(o => o.setName('image6').setDescription('Image match 6 (URL)').setRequired(false))
    .addStringOption(o => o.setName('match7').setDescription('Match 7 : Équipe A:cote / Équipe B:cote').setRequired(false))
    .addStringOption(o => o.setName('image7').setDescription('Image match 7 (URL)').setRequired(false))
    .addStringOption(o => o.setName('match8').setDescription('Match 8 : Équipe A:cote / Équipe B:cote').setRequired(false))
    .addStringOption(o => o.setName('image8').setDescription('Image match 8 (URL)').setRequired(false))
    .addChannelOption(o => o.setName('channel').setDescription('Channel cible').addChannelTypes(ChannelType.GuildText).setRequired(false)),

  new SlashCommandBuilder()
    .setName('set-result')
    .setDescription('Enregistre le résultat d\'un match et crédite les gains')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('round_id').setDescription('ID du round').setRequired(true))
    .addIntegerOption(o => o.setName('match_numero').setDescription('Numéro du match').setRequired(true).setMinValue(1).setMaxValue(8))
    .addIntegerOption(o => o.setName('vainqueur').setDescription('Équipe gagnante').setRequired(true)
      .addChoices({ name: 'Équipe 1', value: 1 }, { name: 'Équipe 2', value: 2 })
    ),

  new SlashCommandBuilder()
    .setName('close-match')
    .setDescription('Ferme manuellement les votes d\'un match')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('round_id').setDescription('ID du round').setRequired(true))
    .addIntegerOption(o => o.setName('match_numero').setDescription('Numéro du match').setRequired(true).setMinValue(1).setMaxValue(8)),

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
