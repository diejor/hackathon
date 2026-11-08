export const config = {
  sendingEnabled: process.env.SAFESIGNAL_SENDING_ENABLED === 'true',
  photonTextEnabled: process.env.ENABLE_PHOTON_TEXT === 'true',
  voiceEnabled: process.env.ENABLE_VOICE === 'true',
  maxSendsPerPlayer: parseInt(process.env.MAX_SENDS_PER_PLAYER || '3', 10),
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  spectrumProjectId: process.env.SPECTRUM_PROJECT_ID!,
  spectrumProjectSecret: process.env.SPECTRUM_PROJECT_SECRET!,
};
