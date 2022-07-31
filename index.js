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
const { ActionRowBuilder, ButtonBuilder } = require('@discordjs/builders');
const { JsonDB } = require('node-json-db');
const { Config } = require('node-json-db/dist/lib/JsonDBConfig');
const { AudioPlayerStatus } = require('@discordjs/voice');

const arl = "1dbd7b297eca225b64ee35e68af7cba7e007a1c178b35fe97cc615bbb4df0094d3d945391adba0c5b1d19554cc85e71ce543c24499551eae3f6a5d0ea52973d010de77c5aede6e2dcee7c23e66f45217f84aaade24353434f6f533d56a9c04d1";
const TOKEN = "MTAwMTE3ODYwNTY2NzIyOTgyNg.GQ7Ynx.Ker6HYCYfy2UBTXvFZMXrp29-oXpwabkzSGTfk";


let quoiReplies = ['Feur ','Feuse ','Fé','Fure','Chi','Drado','Resma','Driceps','Drilatère','Druplé','D','Drupède','Tuor','De neuf','Ffage','Artz','K','Ntche','La','La Lumpur','Terback','Dragénaire','Drilataire','Druple','Fure','Que','Dricolore','Ker','Gliarella','Ttro','Dalajara','Ffé','Ncer','Dri','Drillion ','Drillage','Drisyllabe ','Rteron','Drireacteur'];
let quoiTriggers = ['QUOI', 'QUOI?', 'QUOI ?'];

const player = DiscordVoice.createAudioPlayer();

const deezer = new deezerApi();
var db = new JsonDB(new Config('database', true, true, '/'));

const client = new Discord.Client(
    { 
        partials: ['MESSAGE', 'CHANNEL', 'REACTION'],
        intents: Discord.IntentsBitField.Flags.Guilds | 
        Discord.IntentsBitField.Flags.GuildMessages | 
        Discord.IntentsBitField.Flags.MessageContent |
        Discord.IntentsBitField.Flags.GuildVoiceStates
    }
    ); //create new client

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

client.on('ready', async () => {
    await deezer.loginViaArl(arl);
    console.log(`Logged in as ${client.user.tag}!`);
    try {
        const voicedata = db.getData('/voicedata');

        DiscordVoice.joinVoiceChannel({
            channelId: voicedata.channelId,
            guildId: voicedata.guildId,
            adapterCreator: client.guilds.cache.get(voicedata.guildId).voiceAdapterCreator
        });
    } catch {

    }
})

client.on('interactionCreate', async i => {
    if (!i.isButton()) return;
    const trackId = i.customId.substring(7);
    await i.reply({ content: '**Replaying...**' });
    playTrack(trackId, i.guildId, i.channel, true);
})

function playTrack(trackId, guildId, channel, silent = false) {
    deezer.getTrack(trackId).then(track => {
        if (!silent) {
            channel.send({
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
        }
        const connection = DiscordVoice.getVoiceConnection(guildId);
        if (connection) {
            const decryptStream = new DeezerDecrypt(track.body.SNG_ID);
            https.get(track.getDownloadUrl(1), response => {response.pipe(chunker(2048 * 3 * 4)).pipe(decryptStream)})
            const resource = DiscordVoice.createAudioResource(decryptStream);
            player.play(resource);
            connection.subscribe(player);
        } else {
            channel.send("Please set a voice channel first.");
        }
    });
}

let queue = [];

function playQueue(guildId, channel) {
    if (qe = queue.shift()) {
        playTrack(qe.id, guildId, channel);
    }
    player.on(AudioPlayerStatus.Idle, () => {
        if (queue.length > 0) {
            playQueue(guildId, channel);
        }
    })
}

function printQueue(msg) {
    msg.channel.send(queue.map(qe => { return `** - ${qe.title}**` }).join('\n'));
}

client.on('messageCreate', async msg => {
    let args = msg.content.toUpperCase().split(/ +/);
    let isCommand = (args.shift() === "SUBARU");
    if (isCommand) {
        let command = args.shift();
        if (["SETMC", "SETMUSICCHANNEL"].includes(command)) {
            let voicedata = {
                available: true,
                channelId: msg.channel.id,
                guildId: msg.guild.id,
            };
            db.push('/voicedata', voicedata);
            if(c = DiscordVoice.getVoiceConnection(voicedata.guildId)) c.destroy();
            const connection = DiscordVoice.joinVoiceChannel({
                channelId: voicedata.channelId,
                guildId: voicedata.guildId,
                adapterCreator: msg.guild.voiceAdapterCreator
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
        if(command === "QUEUE") {
            if (queue.length > 0) {
                printQueue(msg);
            } else {
                msg.channel.send("The music queue is empty :(");
            }
        }
        if(command === "PLAY") {
            if (args.length == 0) {
                if (queue.length < 1) {
                    msg.channel.send("The music queue is empty.");
                } else if (player.state.status !== AudioPlayerStatus.Playing) {
                    playQueue(msg.guild.id, msg.channel);                                      
                }
            } else {
                let track_name = args.join(" ");
                deezer.legacySearch(track_name, 'track', 1).then(tracks => {
                    if (tracks.data[0]) {
                        queue.push({ 
                            id: tracks.data[0].id,
                            title: tracks.data[0].artist.name + '-' + tracks.data[0].title   
                        });
                        msg.channel.send(`**${tracks.data[0].title}** has been added to your queue.`);
                        if (player.state.status !== AudioPlayerStatus.Playing) {
                            playQueue(msg.guild.id, msg.channel);
                        }
                    } else {
                        msg.channel.send("Could not find the music you're looking for :(");
                    }
                });
            }
        }
        if (command === "FLOW") {
            deezer.legacyGetUserFlow().then(body => {
                queue = []
                body.data.map(song => {
                    queue.push({ 
                        id: song.id,
                        title: song.artist.name + '-' + song.title   
                    });
                });
                msg.channel.send('Playing flow ...');
                printQueue(msg);
                playQueue(msg.guild.id, msg.channel);
            });
        }
        if (command === "CLEAR") {
            if(player.state.status === AudioPlayerStatus.Playing) {
                player.stop();
            }
            queue = [];
            msg.channel.send("The music queue has been cleared.");
        }
        if (command === "SKIP") {
            if(queue.length > 0) {
                playQueue(msg.guild.id, msg.channel);
            } else {
                msg.channel.send("No more music to play. Stopping...");
                player.stop();
            }
        }
        if (command === "STOP") {
            msg.channel.send("The player has stoped.");
            player.stop();
            player.removeAllListeners();
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