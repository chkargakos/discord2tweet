// Files
const fs = require('fs'),
    request = require('request');

// Configs
const config = require("./config.json");
const prefix = config.prefix,
    guildID = config.guildID,
    secretChannelID = config.secretChannelID,
    ignoreList = config.ignoreList;
require('dotenv').config();

// Discord
const Discord = require("discord.js");
const client = new Discord.Client({ disableMentions: "everyone" });
client.commands = new Discord.Collection();

// Twitter
const { TwitterApi } = require("twitter-api-v2");

const twitterClient = new TwitterApi({
    appKey: process.env.appKey,
    appSecret: process.env.appSecret,
    accessToken: process.env.accessToken,
    accessSecret: process.env.accessSecret,
});

const clientRW = twitterClient.readWrite;

// Basic command handler
fs.readdir("./commands/", (err, files) => {
    if (err) throw err;
    let jsfile = files.filter(f => f.split(".").pop() === "js");

    if (jsfile.length <= 0) {
        console.log("no commands");
        return;
    }
    jsfile.forEach(function (f) {
        let props = require(`./commands/${f}`);
        console.log(f);
        client.commands.set(props.help.name, props);
    });
});

client.on("ready", () => {
    console.log(`${client.user.username} is up`);
    client.user.setActivity("Discord to Twitter", { type: "STREAMING" });
});

client.on("message", async (message) => {
    // Avoid replying to other bots and outside of a specific server
    if (message.author.bot || message.guild.id !== guildID) return;

    // Remove as many characters as the prefix's length and split on every space from message content
    const args = message.content.slice(prefix.length).split(/ +/);
    const commandName = args.shift().toLowerCase();

    // IMPORTANT: use message.content.toLowercase() for any prefixes that include cAsE sEnSiTiVe characters (yes this will eat up more ram)
    if ((message.attachments).array().length > 0 && (!ignoreList.includes(message.channel.id))) {
        if (message.content.includes("gif")) return; // in case the message can't be posted on twitter (over the character limit)
        
        let attachment = (message.attachments).array()[0]; // get the first attachment
        let ext = ".png";

        // Download attachment at ./temp.${extension}
        request.head(attachment.url, function (err, res, body) {
            if (res.headers['content-length'] > 52428800) return; // 50 mb limit
            if (res.headers['content-type'][0] == "v") ext = ".mp4"; // cheeky way to check if file is a video or an image (not the brightest idea)

            request(attachment.url).pipe(fs.createWriteStream(`temp${ext}`)).on("close", async () => {

                // Try to upload the file with message.content
                try {

                    // Create mediaID  
                    const mediaID = await twitterClient.v1.uploadMedia(
                        `./temp${ext}`
                    );

                    // Upload to twitter
                    await clientRW.v2.tweet({
                        text: "",
                        media: { media_ids: [mediaID] },
                    });

                    // Delete ./temp.${extension}
                    fs.unlinkSync(`./temp${ext}`);

                } catch (error) {
                    // On error throw err and delete file (TODO: add way to check if the file exists because if it doesn't it will crash)
                    console.log(error);
                    fs.unlinkSync(`./temp${ext}`);
                }

            });
        });
    } else if (message.content.startsWith(prefix)) {
        try {
            const command =
                client.commands.get(commandName) ||
                client.commands.find(
                    cmd => cmd.help.aliases && cmd.help.aliases.includes(commandName)
                );

            // Cool for testing features in a channel, look for "secretChannelID" on the config_example.json file
            if (command.help.type == 'restricted' && message.channel.id != secretChannelID) return;

            command.run(client, message, args);
        } catch (err) {
            console.log(err);
        }
    }

});

client.login(process.env.DISCORD_TOKEN);
