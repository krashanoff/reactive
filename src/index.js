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
      console.error("Something went wrong when fetching the message: ", err);
      return;
    }
  }

  // We ignore certain message types.
  if (reaction.message.author === client.user)
    return;

  const msg = reaction.message;
  const totalReacts = reactionCount(msg);
  const reactMin = await db.getReactionMin(msg.guild.id);

  if (totalReacts >= reactMin) {
    const fwdID = await db.getFwdChan(msg.guild.id);
    const fwdChan = await client.channels.resolve(fwdID);

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
      .setFooter(`reactive v${process.env.npm_package_version}`, client.user.avatarURL());

    await fwdChan?.send(embed);
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

  // We ignore certain message types.
  if (reaction.message.author === client.user)
    return;

  const minReacts = await db.getReactionMin(reaction.message.guild.id);
  const totalReacts = reactionCount(reaction.message);
  console.info("Message reaction removed.", totalReacts);

  if (totalReacts < minReacts) {
    console.info("TODO: remove from starboard.");
  }
});

client.on("ready", () => console.log(`Logged in as ${client.user.tag}!`));
client.login(process.env.TOKEN);
