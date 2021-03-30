const db = require("./db.js");

// Sets the minimum number of reactions required to
// reach the board.
const setMin = async (msg, args) => {
  const guild = msg.guild;
  const newLimit = Number(args[0]) || -1;
  console.info(newLimit);

  if (args.length !== 1 || newLimit <= 0)
    return await msg.reply("Invalid args.");
  if (!guild)
    return await msg.reply("Could not find guild!");

  await db.setReactionMin(guild.id, newLimit);
  await msg.reply(`Set reaction limit to ${newLimit}!`);
};

// Sets the channel to repost to.
const setChan = async (msg, args) => {
  const guild = msg.guild;
  const channel = msg.mentions.channels.firstKey();

  if (args.length !== 1 || !channel)
    return await msg.reply("Invalid args.");

  await db.setFwdChan(guild.id, channel);
  await msg.reply(`Set repost channel to <#${channel}>!`);
};

module.exports = {
  setMin,
  setChan,
};
