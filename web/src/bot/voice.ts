// Voice input for the Help Bot composer via the browser's Web Speech API (SpeechRecognition).
// Dictation only fills the textarea; it never sends. The user reviews the text, then taps Send.
//
// PRIVACY: Chrome's (and Edge's) SpeechRecognition is not on-device: it streams the microphone audio
// to Google's (Microsoft's) speech servers to transcribe it. Safari uses Apple's service. Only the
// resulting text reaches our server, but the audio does leave the device, so it's opt-in (tap the mic).
//
// Browsers without the API (e.g. Firefox) or pages that aren't a secure context (plain http on a LAN
// IP, where the mic permission is always denied) get no button at all: voiceSupported() is false.

// Minimal typings: the Web Speech API isn't in TypeScript's DOM lib.
interface SpeechAlt { transcript: string }
interface SpeechResult { isFinal: boolean; length: number; [i: number]: SpeechAlt }
interface SpeechResultEvent { resultIndex: number; results: { length: number; [i: number]: SpeechResult } }
interface SpeechErrorEvent { error: string }
interface Recognition {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  onresult: ((e: SpeechResultEvent) => void) | null;
  onerror: ((e: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
type RecognitionCtor = new () => Recognition;

function ctor(): RecognitionCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export const voiceSupported = () => !!ctor() && window.isSecureContext;

const ERRORS: Record<string, string> = {
  "not-allowed": "Microphone access is blocked. Allow it in your browser settings to use voice.",
  "service-not-allowed": "Voice input isn't available in this browser right now.",
  "no-speech": "I didn't hear anything. Tap the mic and try again.",
  "audio-capture": "No microphone found.",
  network: "Voice input needs an internet connection.",
};

export interface Dictation {
  readonly active: boolean;
  /** Start listening, or stop if already listening. */
  toggle(): void;
  /** Stop and drop anything not yet transcribed (e.g. when the message is sent). */
  cancel(): void;
}

/**
 * Dictate into `field`: interim text streams in after whatever was already typed. `onState` fires on
 * start/stop, `onError` with a short user-facing message.
 */
export function createDictation(field: HTMLTextAreaElement, opts: {
  onText: () => void; onState: () => void; onError: (message: string) => void;
}): Dictation {
  let rec: Recognition | null = null;

  const finish = (r: Recognition) => {
    if (rec !== r) return;
    rec = null;
    opts.onState();
  };

  function start() {
    const Ctor = ctor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = navigator.language || "en-US";
    r.interimResults = true;
    // Single utterance: ends by itself after a pause (or when tapped again). Continuous mode repeats
    // earlier results on Android Chrome, which would duplicate text.
    r.continuous = false;
    r.maxAlternatives = 1;
    const base = field.value && !/\s$/.test(field.value) ? `${field.value} ` : field.value;
    let finalText = "";
    r.onresult = (e) => {
      if (rec !== r) return;
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interim += res[0].transcript;
      }
      field.value = (base + finalText + interim).slice(0, field.maxLength > 0 ? field.maxLength : undefined);
      opts.onText();
    };
    r.onerror = (e) => {
      if (rec !== r) return;
      const msg = ERRORS[e.error];
      if (msg) opts.onError(msg);
      else if (e.error !== "aborted") opts.onError("Voice input stopped. Try again.");
    };
    r.onend = () => finish(r);
    rec = r;
    try {
      r.start();
    } catch {
      rec = null;
      opts.onError("Couldn't start voice input. Try again.");
    }
    opts.onState();
  }

  return {
    get active() { return rec !== null; },
    toggle() {
      if (rec) rec.stop(); // final result (if any) still arrives, then onend
      else start();
    },
    cancel() {
      const r = rec;
      if (!r) return;
      rec = null; // ignore any late results
      r.abort();
      opts.onState();
    },
  };
}
