require('dotenv').config()
const { Client, GatewayIntentBits, WebhookClient, EmbedBuilder } = require('discord.js');
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMembers,
	],
});

// State Variables
const channelAdjList = new Map()
const channelIdToWHClient = new Map()
const WHDir = {
  LEFT: 0,
  RIGHT: 1,
  BOTH: 2,
}

// User Defined Variables
const pudHook1 = new WebhookClient({ url: process.env.PUD_HOOK_1 });
const kscopeHook1 = new WebhookClient({ url: process.env.KSCOPE_HOOK_1 });
const pudHook2 = new WebhookClient({ url: process.env.PUD_HOOK_2 });
const kscopeHook2 = new WebhookClient({ url: process.env.KSCOPE_HOOK_2 });
const WHClientArray = [pudHook1, kscopeHook1, pudHook2, kscopeHook2]
const WHClientRelations = [[pudHook1, kscopeHook1, WHDir.BOTH], [pudHook2, kscopeHook2, WHDir.BOTH]]

// Create a map from Channel ID to WebhookClient
const setupChIDLookup = async () => {
  await Promise.all(WHClientArray.map(async WHClient => {
    const webhook = await client.fetchWebhook(WHClient.id, WHClient.token)
    channelIdToWHClient.set(webhook.channelId, WHClient)
    WHClient.channelId = webhook.channelId
  }))
}

// Represent channel crosspost directions with an Adjacency List
const setupAdjList = async () => {
  WHClientRelations.forEach(pair => {
    const [WH_A, WH_B, DIR] = pair
    const WH_A_Array = channelAdjList.get(WH_A.channelId) || []
    const WH_B_Array = channelAdjList.get(WH_B.channelId) || []
    DIR != WHDir.LEFT && WH_A_Array.push(WH_B.channelId) && channelAdjList.set(WH_A.channelId, WH_A_Array)
    DIR != WHDir.RIGHT && WH_B_Array.push(WH_A.channelId) && channelAdjList.set(WH_B.channelId, WH_B_Array)
  })
}

// Event on bot ready state
client.on("ready", async () => {
  await setupChIDLookup()
  await setupAdjList()
  console.log("channelAdjList: ", channelAdjList)
  console.log("I am ready!");
});

// Bot command prefix
const prefix = "~";
// This image URL regex catches direct CDN media files or website links
const imageURLRegex = /(https?:\/\/.*\.(?:png|jpg|jpeg|webp|gif))|(https?:\/\/.*\.com.*)/gi;

// Helper function to send a msg from a Webhook
const WHSendMsg = (WHClient, message, content) => {
  WHClient.send({
    content: content,
    username: message.member.nickname,
    avatarURL: message.member.displayAvatarURL(),
  })
}

const WHSendMsgMulti = (targetChannels, message, content) => {
  const WHClients = targetChannels.map(channelId => channelIdToWHClient.get(channelId))
  WHClients.forEach(async WHClient => WHSendMsg(WHClient, message, content))
}

// Event on message create
client.on("messageCreate", (message) => {
  // Return if sender is a bot
  if (message.author.id === client.user.id || message.author.bot) return;

  // Crosspost if the channel ID has an active webhook
  if (channelAdjList.has(message.channelId)) {
    const targetChannels = channelAdjList.get(message.channelId)
    // Handle image URLs
    message.content.match(imageURLRegex) && WHSendMsgMulti(targetChannels, message, message.content)
    // Handle image attachments
    if (message.attachments) {
      const attachments = [...message.attachments]
      const imageURLs = attachments.map(attachment => attachment[1].url)
      imageURLs.forEach(image => WHSendMsgMulti(targetChannels, message, image))
    }
  }

  if (message.content.startsWith(`${prefix}ping`)) {
    message.channel.send("pong!");
    // pudHook1.send("Test1")
    // kscopeHook1.send({
    //   content: "pong",
    //   username: message.member.nickname,
    //   avatarURL: message.member.displayAvatarURL(),
    // })
  }
});

client.login(process.env.BOT_PW);
