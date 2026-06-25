const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('create-bracket')
    .setDescription('Crée un bracket de pronostics')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('nom').setDescription('Nom du round (ex: 16es de finale)').setRequired(true))
    .addStringOption(o => o.setName('match1').setDescription('Match 1 : Équipe A / Équipe B').setRequired(true))
    .addStringOption(o => o.setName('image1').setDescription('Image du match 1 (URL)').setRequired(false))
    .addStringOption(o => o.setName('match2').setDescription('Match 2 : Équipe A / Équipe B').setRequired(false))
    .addStringOption(o => o.setName('image2').setDescription('Image du match 2 (URL)').setRequired(false))
    .addStringOption(o => o.setName('match3').setDescription('Match 3 : Équipe A / Équipe B').setRequired(false))
    .addStringOption(o => o.setName('image3').setDescription('Image du match 3 (URL)').setRequired(false))
    .addStringOption(o => o.setName('match4').setDescription('Match 4 : Équipe A / Équipe B').setRequired(false))
    .addStringOption(o => o.setName('image4').setDescription('Image du match 4 (URL)').setRequired(false))
    .addStringOption(o => o.setName('match5').setDescription('Match 5 : Équipe A / Équipe B').setRequired(false))
    .addStringOption(o => o.setName('image5').setDescription('Image du match 5 (URL)').setRequired(false))
    .addStringOption(o => o.setName('match6').setDescription('Match 6 : Équipe A / Équipe B').setRequired(false))
    .addStringOption(o => o.setName('image6').setDescription('Image du match 6 (URL)').setRequired(false))
    .addStringOption(o => o.setName('match7').setDescription('Match 7 : Équipe A / Équipe B').setRequired(false))
    .addStringOption(o => o.setName('image7').setDescription('Image du match 7 (URL)').setRequired(false))
    .addStringOption(o => o.setName('match8').setDescription('Match 8 : Équipe A / Équipe B').setRequired(false))
    .addStringOption(o => o.setName('image8').setDescription('Image du match 8 (URL)').setRequired(false))
    .addChannelOption(o => o.setName('channel').setDescription('Channel cible').addChannelTypes(ChannelType.GuildText).setRequired(false)),

  new SlashCommandBuilder()
    .setName('set-result')
    .setDescription('Enregistre le résultat d\'un match')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('round_id').setDescription('ID du round').setRequired(true))
    .addIntegerOption(o => o.setName('match_numero').setDescription('Numéro du match (1, 2, 3...)').setRequired(true).setMinValue(1).setMaxValue(8))
    .addIntegerOption(o => o.setName('vainqueur').setDescription('Équipe gagnante (1 = première, 2 = deuxième)').setRequired(true)
      .addChoices({ name: 'Équipe 1', value: 1 }, { name: 'Équipe 2', value: 2 })
    ),

  new SlashCommandBuilder()
    .setName('classement-bracket')
    .setDescription('Affiche le classement du bracket')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o => o.setName('round_id').setDescription('ID du round').setRequired(true)),

  new SlashCommandBuilder()
    .setName('post-bracket')
    .setDescription('Reposte un bracket existant dans un channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('round_id').setDescription('ID du round').setRequired(true))
    .addChannelOption(o => o.setName('channel').setDescription('Channel cible').addChannelTypes(ChannelType.GuildText).setRequired(false)),

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
