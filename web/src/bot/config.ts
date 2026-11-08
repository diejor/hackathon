// Help Bot messaging-app settings (iMessage through Photon; server side: spacetimedb/Photon.cs).
// The bot's iMessage address: the number Photon assigns to the shared line (dashboard → iMessage).
// Placeholder until we have a line; shown in "Link iMessage".
export const BOT_IMESSAGE_ADDRESS = "+1 (555) 010-0188";

/** Display names for ChatMessage.channel values other than "web". */
export const CHANNEL_LABELS: Record<string, string> = {
  imessage: "iMessage", whatsapp: "WhatsApp", whatsapp_business: "WhatsApp", sms: "SMS", telegram: "Telegram", email: "email",
};
