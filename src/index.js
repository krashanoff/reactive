require("dotenv").config();

const Discord = require("discord.js");
const db = require("./db.js");

const client = new Discord.Client({
  partials: ["USER", "CHANNEL", "MESSAGE", "REACTION"],
});

const PREFIX = "..";
const CMD_PFX = name => `${PREFIX}${name}`;

// Mapping of command names to functions of the form
// `(Discord.Message, Array<String>) => void`. Most functions
// simply manipulate the guild's settings.
const COMMANDS = require("./cmd.js");

/**
 * Retrieves the total number of reactions for a given post.
 *
 * @param {Discord.Message} msg Message to count reactions on.
 * @returns {Number} Total number of reactions.
 */
const reactionCount = msg =>
  msg.reactions.cache.reduce((acc, react) => acc + react.count, 0);

const messageTemplate = (msg, totalReacts) => {
  let embed = new Discord.MessageEmbed()
    .setColor("#f850d2")
    .setAuthor(msg.author.tag, msg.author.avatarURL({
      dynamic: true,
      size: 64,
    }))
    .setDescription(msg.content)
    .addField(`**${totalReacts}** Reacts`, `[Original](${msg.url})`);

  if (msg.attachments.array().length > 0)
    embed.setImage(msg.attachments.array()[0].proxyURL);

  embed
    .setTimestamp()
    .setFooter("reactive", client.user.avatarURL());

  return embed;
};


// Simple command parser.
client.on("message", async msg => {
  for (const [cmdName, cmd] of Object.entries(COMMANDS)) {
    const prefix = CMD_PFX(cmdName);

    if (!msg.content.startsWith(prefix)) continue;
    await cmd(msg, msg.content.slice(prefix.length + 1)?.split(" "));
  }
});

// If the total reaction count exceeds the server's limit,
// add it to the board.
client.on("messageReactionAdd", async reaction => {
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (err) {
      console.error("Couldn't fetch reaction on old message: ", err);
      return;
    }
  }

  // Ignore bot messages.
  if (reaction.message.author.bot)
    return;

  const msg = reaction.message;
  const totalReacts = reactionCount(msg);
  const fwdID = await db.getFwdChan(msg.guild.id);
  const fwdChan = await client.channels.resolve(fwdID);

  // If the message has been added to the board already, edit
  // our message to reflect the new count.
  const onBoard = await db.onBoard(msg.id);
  if (onBoard) {
    const oldMsg = await fwdChan.messages.fetch(onBoard);
    await oldMsg.edit(messageTemplate(msg, totalReacts));
    return;
  }

  // Otherwise, check if we need to add a new post.
  const reactMin = await db.getReactionMin(msg.guild.id);
  if (totalReacts >= reactMin) {
    const sentMsg = await fwdChan.send(messageTemplate(msg, totalReacts));
    await db.addMapping(msg.id, sentMsg.id);
  }
});

// If the total reaction count falls below the server's
// limit, remove it from the board.
client.on("messageReactionRemove", async reaction => {
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (err) {
      console.error("Couldn't fetch reaction on old message: ", err);
      return;
    }
  }

  // Ignore bot messages.
  if (reaction.message.author.bot)
    return;

  const msg = reaction.message;

  // Only operate on messages posted to the board.
  const onBoard = await db.onBoard(msg.id);
  if (!onBoard)
    return;

  const minReacts = await db.getReactionMin(reaction.message.guild.id);
  const totalReacts = reactionCount(reaction.message);
  const fwdID = await db.getFwdChan(msg.guild.id);
  const fwdChan = await client.channels.resolve(fwdID);

  // Drop from the board.
  if (totalReacts < minReacts) {
    await fwdChan.messages.fetch(onBoard).delete({
      reason: "Less reactions than required to remain on the board.",
    });
    await db.removeMapping(msg.id);
    return;
  }

  // Otherwise update to reflect the new count.
  const oldMsg = await fwdChan.messages.fetch(onBoard);
  await oldMsg.edit(messageTemplate(msg, totalReacts));
});

client.on("ready", () => console.info(`Logged in as ${client.user.tag}!`));
client.login(process.env.TOKEN);
