// Help Bot messaging-app settings (iMessage through Photon; server side: spacetimedb/Photon.cs).
// The bot's iMessage address: the number Photon assigns to the shared line (dashboard → iMessage).
// Empty until we have a line: "Link iMessage" stays hidden while this is "".
export const BOT_IMESSAGE_ADDRESS = "";

/** Display names for ChatMessage.channel values other than "web". */
export const CHANNEL_LABELS: Record<string, string> = {
  imessage: "iMessage", whatsapp: "WhatsApp", whatsapp_business: "WhatsApp", sms: "SMS", telegram: "Telegram", email: "email",
};
