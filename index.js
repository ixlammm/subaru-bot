require('dotenv').config(); //initialize dotenv
const Discord = require('discord.js'); //import discord.js
const deezerApi = require('./deezer-api')
const deezer = new deezerApi();

const arl = "1dbd7b297eca225b64ee35e68af7cba7e007a1c178b35fe97cc615bbb4df0094d3d945391adba0c5b1d19554cc85e71ce543c24499551eae3f6a5d0ea52973d010de77c5aede6e2dcee7c23e66f45217f84aaade24353434f6f533d56a9c04d1";
const TOKEN = "MTAwMTE3ODYwNTY2NzIyOTgyNg.GQ7Ynx.Ker6HYCYfy2UBTXvFZMXrp29-oXpwabkzSGTfk";

deezer.loginViaArl(arl);

const client = new Discord.Client(
    { 
        partials: ['MESSAGE', 'CHANNEL', 'REACTION'],
        intents: Discord.IntentsBitField.Flags.Guilds | Discord.IntentsBitField.Flags.GuildMessages | Discord.IntentsBitField.Flags.MessageContent
    }
    ); //create new client


client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

let quoiReplies = ['Feur ','Feuse ','Fé','Fure','Chi','Drado','Resma','Driceps','Drilatère','Druplé','D','Drupède','Tuor','De neuf','Ffage','Artz','K','Ntche','La','La Lumpur','Terback','Dragénaire','Drilataire','Druple','Fure','Que','Dricolore','Ker','Gliarella','Ttro','Dalajara','Ffé','Ncer','Dri','Drillion ','Drillage','Drisyllabe ','Rteron','Drireacteur'];
let quoiTriggers = ['QUOI', 'QUOI?', 'QUOI ?'];

client.on('messageCreate', msg => {
    let args = msg.content.split(/ +/);
    let isCommand = (args.shift() === "subaru");
    if (isCommand) {
        let command = args.shift();
        if(command === "play") {
            let track_name = args.join(" ");
            deezer.legacySearch(track_name, 'track', 1).then(tracks => {
                deezer.legacyGetTrack(tracks.data[0].id).then(track => {
                    let attachement = new Discord.AttachmentBuilder(track.album.cover_medium).attachment
                    msg.channel.send(`Now playing: ${track.artist.name} - ${track.title}`);
                    msg.channel.send({ files: [ 'https://cdn.discordapp.com/icons/222078108977594368/6e1019b3179d71046e463a75915e7244.png?size=2048' ] });
                });
            });
        }
    }
    else {
        if (quoiTriggers.some(quoiTrigger => { return msg.content.toUpperCase().endsWith(quoiTrigger) })) {
            msg.reply('..'+quoiReplies[Math.floor(Math.random()*quoiReplies.length)].toLowerCase());
        }
    }
});

//make sure this line is the last line
client.login(TOKEN); //login bot using token