require('dotenv').config(); //initialize dotenv
const { ButtonStyle } = require('discord.js');
const Discord = require('discord.js'); //import discord.js
const DiscordVoice = require('@discordjs/voice');
const Deezer = require('./deezer-api');
const deezerApi = require('./deezer-api')
const fetch = require('node-fetch');
const crypto = require('crypto')
const fs = require('fs');
const { deepEqual } = require('assert');
const https = require('https');
const { Duplex, Transform, PassThrough } = require('stream');
const utils = require('./utils');
const { setNonEnumerableProperties } = require('got');
const chunker = require('stream-chunker');

const arl = "1dbd7b297eca225b64ee35e68af7cba7e007a1c178b35fe97cc615bbb4df0094d3d945391adba0c5b1d19554cc85e71ce543c24499551eae3f6a5d0ea52973d010de77c5aede6e2dcee7c23e66f45217f84aaade24353434f6f533d56a9c04d1";
const TOKEN = "MTAwMTE3ODYwNTY2NzIyOTgyNg.GQ7Ynx.Ker6HYCYfy2UBTXvFZMXrp29-oXpwabkzSGTfk";

const deezer = new deezerApi();

deezer.loginViaArl(arl);

const client = new Discord.Client(
    { 
        partials: ['MESSAGE', 'CHANNEL', 'REACTION'],
        intents: Discord.IntentsBitField.Flags.Guilds | 
        Discord.IntentsBitField.Flags.GuildMessages | 
        Discord.IntentsBitField.Flags.MessageContent |
        Discord.IntentsBitField.Flags.GuildVoiceStates
    }
    ); //create new client

let quoiReplies = ['Feur ','Feuse ','Fé','Fure','Chi','Drado','Resma','Driceps','Drilatère','Druplé','D','Drupède','Tuor','De neuf','Ffage','Artz','K','Ntche','La','La Lumpur','Terback','Dragénaire','Drilataire','Druple','Fure','Que','Dricolore','Ker','Gliarella','Ttro','Dalajara','Ffé','Ncer','Dri','Drillion ','Drillage','Drisyllabe ','Rteron','Drireacteur'];
let quoiTriggers = ['QUOI', 'QUOI?', 'QUOI ?'];

const player = DiscordVoice.createAudioPlayer();

class DeezerDecrypt extends Transform {
    constructor(trackId) {
        super();
        this.trackId = trackId;
    }

    _transform(chunk, encoding, callback) {
        this.push(deezer.decryptDownload(chunk, this.trackId));
        callback();
    }

    _final(callback) {
        callback();
    }
}

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);

    const data = fs.readFileSync('database', { encoding: 'utf-8', flag: 'r' });
    let voicedata = JSON.parse(data);
    if (voicedata.available) {
        const guild = client.guilds.cache.get(voicedata.guildId);
        DiscordVoice.joinVoiceChannel({
            channelId: voicedata.channelId,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator
        });
    }
})

function playTrack(trackId) {
    deezer.getTrack(trackId).then(track => {
        msg.channel.send({
            content: '*Playing Next:*',
            embeds: [
            {
                title: `**${track.body.ART_NAME} - ${track.body.SNG_TITLE}**`,
                fields: [
                    { 
                        name: 'Duration',
                        value: `${new Date(track.body.DURATION * 1000).toISOString().substring(14, 19)}`
                    }
                ],  
                thumbnail: {
                    url: 'attachment://cover.jpg'
                }
            }
            ],
            files: [{
            attachment: deezer.albumPicturesHost + track.body.ALB_PICTURE + '/264x264-000000-80-0-0.jpg',
            name: 'cover.jpg'
            }]
        })
        var decryptStream = new DeezerDecrypt(track.body.SNG_ID);
        https.get(track.getDownloadUrl(1), response => {response.pipe(chunker(2048 * 3 * 4)).pipe(decryptStream)})
        const connection = DiscordVoice.getVoiceConnection(msg.guild.id);
        if (connection) {
            const resource = DiscordVoice.createAudioResource(decryptStream);
            player.play(resource);
            connection.subscribe(player);
        } else {
            msg.channel.send("Please set a voice channel first.");
        }
    })
});
}

client.on('messageCreate', msg => {
    let args = msg.content.toUpperCase().split(/ +/);
let isCommand = (args.shift() === "SUBARU");
    if (isCommand) {
        let command = args.shift();
        if (command === "SETMC") {
            console.log(msg.channel.guild.voiceAdapterCreator);
            let voicedata = {
                available: true,
                channelId: msg.channel.id,
                guildId: msg.guild.id,
                adapterCreator: msg.channel.guild.voiceAdapterCreator
            };
            fs.writeFileSync('database', JSON.stringify(voicedata), 'utf-8');
            if(c = DiscordVoice.getVoiceConnection(voicedata.guildId)) c.destroy();
            const connection = DiscordVoice.joinVoiceChannel({
                channelId: voicedata.channelId,
                guildId: voicedata.guildId
            });
            if (!connection) {
                msg.channel.send("Could not set current channel as Music Channel");
            } else {
                msg.channel.send("Current channel set as **Music Channel**");
            }
        }
        if(command === "LEAVE") {
            const connection = DiscordVoice.getVoiceConnection(msg.guild.id);
            if (connection) {
                msg.channel.send("Bye. ");
                connection.destroy();
            } else {
                msg.channel.send("I'm not even in a voice channel :(");
            }
        }
        if(command === "PLAY") {
            let track_name = args.join(" ");
            deezer.legacySearch(track_name, 'track', 1).then(tracks => {
                if (tracks.data) {
                    playTrack(tracks.data[0].id);
                } else {
                    msg.channel.send("Could not find the music you're looking for :(");
                }
            });
        }
        if (command === "STOP") {
            msg.channel.send("The player has stoped.");
            player.stop();
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