// SafeSense / Help Bot SpacetimeDB module, TypeScript port of the C# module in ../spacetimedb.
// Same public surface: table, view, reducer and procedure names, column order and HTTP routes.
//
//   schema.ts    all tables, shared types and the module environment
//   lib.ts       Lib.cs       rooms and lobby
//   activity.ts  Activity.cs  game activity + the coaching summary
//   ai.ts        Ai.cs        OpenAI-compatible client, ai_ping, ai_ask
//   bot.ts       Bot.cs       chat, memory, forget_me, bot_send
//   discord.ts   Discord.cs   Discord interactions (+ Ed25519.cs via crypto.ts)
//   photon.ts    Photon.cs    Photon messaging, channel links (+ Sha256.cs via crypto.ts)
//   practice.ts  (new)        practice scam texts by iMessage (templates, limits, grading)
//
// Only values registered with SpacetimeDB are exported from this entry file; the export name is the
// function's name (snake_cased for clients).
import spacetimedb from './schema';
import { Router } from 'spacetimedb/server';
import { challengeLanding, challengeResponse, challengeClaim } from './challenge';
export { challengeRunJob, demoCallRunJob, challengeLanding, challengeResponse, challengeClaim, startChallengeDemo, confirmChallengeEngaged } from './challenge';
import { photonWebhook } from './photon';
import { discordInteractions } from './discord';

export default spacetimedb;

export {
  myRoom,
  myRoomMembers,
  createRoom,
  joinRoom,
  leaveRoom,
  setName,
  setReady,
  chooseGame,
  startGame,
  returnToLobby,
  clientConnected,
  clientDisconnected,
  cleanupDisconnected,
} from './lib';
export { myActivity, logActivity, seedDemoActivity } from './activity';
export { aiPing, aiAsk } from './ai';
export { myMessages, myFacts, forgetMe, botSend } from './bot';
export { discordInteractions, discordRunJob } from './discord';
export { myLinkCode, myChannelLinks, createLinkCode, unlinkChannels, photonWebhook, practiceRunJob } from './photon';
export { myPracticeTexts, requestPracticeText } from './practice';

// Photon.cs Routes(): served at /v1/database/<db>/route/<path>.
export const routes = spacetimedb.httpRouter(new Router().post('/photon', photonWebhook).post('/discord', discordInteractions)
  .post('/challenge-response', challengeResponse).get('/challenge', challengeLanding).post('/challenge', challengeClaim));
