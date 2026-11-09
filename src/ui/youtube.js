// YouTube-Video mit Tempo und A-B-Loop.
import { html, useEffect, useRef, useState } from '../../vendor/htm-preact.js';
import { clamp } from '../lib/core.js';
import { Button } from './common.js';

let apiPromise = null;

function loadYouTube() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => reject(new Error('YouTube ist gerade nicht erreichbar.'));
    window.onYouTubeIframeAPIReady = () => resolve(window.YT);
    document.head.append(s);
  });
  return apiPromise;
}

export function youTubeId(url) {
  const m = String(url).match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export function YouTubePane({ videoId }) {
  const holder = useRef(null);
  const player = useRef(null);
  const [rate, setRate] = useState(1);
  const [a, setA] = useState(null);
  const [b, setB] = useState(null);
  const [loop, setLoop] = useState(false);
  const [error, setError] = useState('');
  const live = useRef({});
  live.current = { a, b, loop };

  useEffect(() => {
    let alive = true;
    let poll = 0;
    loadYouTube().then((YT) => {
      if (!alive) return;
      player.current = new YT.Player(holder.current, {
        videoId,
        host: 'https://www.youtube-nocookie.com',
        playerVars: { playsinline: 1, rel: 0 },
      });
      poll = setInterval(() => {
        const p = player.current;
        const { a: from, b: to, loop: on } = live.current;
        if (!p?.getCurrentTime || !on || from === null || to === null) return;
        if (p.getCurrentTime() >= to) p.seekTo(from, true);
      }, 120);
    }).catch((e) => setError(e.message));
    return () => {
      alive = false;
      clearInterval(poll);
      player.current?.destroy?.();
    };
  }, [videoId]);

  const change = (delta) => {
    const next = clamp(Math.round((rate + delta) * 100) / 100, 0.25, 2);
    player.current?.setPlaybackRate?.(next);
    setRate(next);
  };
  const now = () => player.current?.getCurrentTime?.() ?? 0;

  if (error) return html`<p class="notice">${error} <a href=${`https://youtu.be/${videoId}`} target="_blank" rel="noopener">Video auf YouTube öffnen</a></p>`;
  return html`<div class="yt">
    <div class="yt-frame"><div ref=${holder}></div></div>
    <div class="row wrap">
      <${Button} size="sm" onClick=${() => change(-0.05)}>−5 %<//>
      <span><b>${Math.round(rate * 100)} %</b></span>
      <${Button} size="sm" onClick=${() => change(0.05)}>+5 %<//>
      <${Button} size="sm" onClick=${() => setA(now())}>Start setzen${a !== null ? ` (${fmt(a)})` : ''}<//>
      <${Button} size="sm" onClick=${() => setB(now())}>Ende setzen${b !== null ? ` (${fmt(b)})` : ''}<//>
      <${Button} size="sm" icon="loop" variant=${loop ? 'on' : 'plain'} disabled=${a === null || b === null} onClick=${() => setLoop(!loop)}>Loop<//>
    </div>
  </div>`;
}
