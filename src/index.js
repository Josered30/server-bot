import dotenv from "dotenv";
import { createRequire } from "module";
import { getInfo, start, stop, restart } from "./aternos/index.js";

const require = createRequire(import.meta.url);
const { Client, Intents, MessageEmbed } = require("discord.js");
const config = require("./config.json");

dotenv.config();

async function messageManage(client, message, prefix) {
  if (message.content.startsWith(`${prefix}`)) {
    let args = message.content.substring(prefix.length).split(" ");
    let info = null;
    let embed = null;

    switch (args[0]) {
      case "start":
        message.channel.send("Starting...");
        info = await start();
        break;
      case "info":
        info = await getInfo();
        embed = new MessageEmbed()
          .setTitle("Server Information")
          .setDescription(
            `Name: ${info.name}\n Status: ${info.status.text}\n Version: ${info.version}, Address: ${info.name}.aternos.me`
          )
          .setColor("#d32256");
        message.channel.send({ embeds: [embed] });
        break;
      case "stop":
        message.channel.send("Stopping...");
        info = await stop();
        break;
      case "restart":
        message.channel.send("Restarting...");
        info = await restart();
        break;
      case "help":
        embed = new MessageEmbed()
          .setTitle("Help")
          .setDescription(
            `start: Start the server\n stop: Stop the server\n restart: Restart the server\n info: Information`
          )
          .setColor("#d32256");
        message.channel.send({ embeds: [embed] });
        break;
      case "config":
        const collector = message.channel.createMessageCollector({ max: 2 });

        await message.channel.send("Username");
        let collected = await message.channel.awaitMessages({
          max: 1,
          time: 30000,
          errors: ["time"],
        });

        await message.channel.send("Password");
        collected = await message.channel.awaitMessages({
          max: 1,
          time: 30000,
          errors: ["time"],
        });

        await message.channel.send("Done");

        break;
      default:
        message.channel.send("invalid");
        break;
    }
  }
}

const client = new Client({
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES],
});
client.on("ready", () => {
  console.log("Bot is ready");
  client.user.setPresence({
    status: "online",
    activities: [
      {
        name: "Use !! to call me",
        type: "PLAYING",
      },
    ],
  });
});

client.on("messageCreate", async (message) => {
  messageManage(client, message, config.prefix);
});

client.login(process.env.DISCORD_TOKEN).catch((e) => console.log(e));
