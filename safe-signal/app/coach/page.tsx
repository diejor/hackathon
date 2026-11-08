'use client';
// Help Bot coach: the Security Arcade chat (../web/src/bot/chat.ts, plain DOM) mounted inside SafeSense.
// Mounted in an effect so nothing touches `window`/`location` during prerender.
import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { helpBot } from '../../src/lib/helpbot';
import '../../../web/src/bot/bot.css';
import './coach.css';

export default function Coach() {
  const host = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useEffect(() => {
    let view: { el: HTMLElement; destroy(): void } | null = null;
    let dead = false;
    void (async () => {
      // helpBot() first: it sets the server/db (NEXT_PUBLIC_STDB_*) that web/src/lobby reads at import
      // time. Importing the chat first would load lobby with its Maincloud defaults.
      await helpBot();
      const { mountChat } = await import('../../../web/src/bot/chat');
      if (dead || !host.current) return;
      view = mountChat({ onBack: () => router.push('/') });
      host.current.replaceChildren(view.el);
    })();
    return () => { dead = true; view?.destroy(); };
  }, [router]);
  return <div ref={host} className="coach-host" />;
}
