module.exports.run = async (bot, message, args) => {
    message.channel.send("ok");
}

module.exports.help = {
    name: "test",
    type: "restricted"
};
