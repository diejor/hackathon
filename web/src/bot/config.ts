// Help Bot messaging-app settings (iMessage through Photon: spacetimedb/Photon.cs; Discord: spacetimedb/Discord.cs).
// The bot's iMessage address: the number Photon assigns to the shared line (dashboard → iMessage).
// Empty until we have a line: "Link iMessage" and the SafeSense chat page's "Text SafeSense" card
// (safesense/src/components/chat/TextSafeSense.tsx) stay hidden while this is "". Server: spacetimedb-ts/src/photon.ts.
export const BOT_IMESSAGE_ADDRESS = "";
// The Discord app's install link (https://discord.com/oauth2/authorize?client_id=<application id>, printed by
// scripts/discord-register.sh). Empty: "Link Discord" stays hidden.
export const DISCORD_INSTALL_URL = "https://discord.com/oauth2/authorize?client_id=1568814277098213547";

/** Display names for ChatMessage.channel values other than "web". */
export const CHANNEL_LABELS: Record<string, string> = {
  imessage: "iMessage", whatsapp: "WhatsApp", whatsapp_business: "WhatsApp", sms: "SMS", telegram: "Telegram", email: "email", discord: "Discord",
};
