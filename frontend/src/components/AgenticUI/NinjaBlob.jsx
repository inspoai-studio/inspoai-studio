import React, { useEffect, useRef, useState } from 'react';
import './NinjaBlob.css';

/**
 * Violet ninja-blob mascot. Drop-in replacement for InteractiveRobot —
 * same prop contract plus isSpinning (click reaction).
 *
 * States: peek (idle bob + blink + eye tracking) → curious (input focused)
 * → reading (typing) → determined (loading) → spin (click) → dash (walk)
 * → sleepy (30s inactivity).
 */
export default function NinjaBlob({
  value = '',
  isFocused = false,
  isLoading = false,
  isWalking = false,
  userName = '',
  side = 'right'
}) {
  const containerRef = useRef(null);
  const [pupil, setPupil] = useState({ x: 0, y: 0 });
  const [tilt, setTilt] = useState(0);
  const [isBlinking, setIsBlinking] = useState(false);
  const [isNear, setIsNear] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [idleStage, setIdleStage] = useState('none'); // none | cry | sleep
  const [pulse, setPulse] = useState(false);
  const blinkTimer = useRef(null);
  const cryTimer = useRef(null);
  const sleepTimer = useRef(null);
  const [trick, setTrick] = useState(null); // jump | flip | emoji
  const trickCooldown = useRef(0);
  const trickTimer = useRef(null);
  const pulseTimer = useRef(null);
  const prevLen = useRef(value.length);

  // Eye tracking: pupils follow the cursor anywhere on screen; the closer the
  // cursor, the stronger the look. Also wakes the blob up.
  useEffect(() => {
    const onMove = (e) => {
      armIdleTimers();
      setIdleStage('none');
      if (isLoading || isWalking) return;

      const el = containerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      setIsNear(dist < 160);
      setIsHovered(dist < 70);

      if (isFocused) return; // reading mode drives the eyes instead

      const angle = Math.atan2(dy, dx);
      const strength = Math.min(1, 90 / Math.max(dist, 90)) * 0.5 + 0.5;
      setPupil({
        x: Math.cos(angle) * 6 * strength,
        y: Math.sin(angle) * 4.5 * strength
      });
      setTilt((dx / window.innerWidth) * 8);
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [isFocused, isLoading, isWalking]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reading mode: look down at the text, eyes sweeping with its length
  useEffect(() => {
    if (isLoading || isWalking) {
      setPupil({ x: 0, y: 0 });
      setTilt(0);
      return;
    }
    if (isFocused) {
      const ratio = Math.min(1, value.length / 60);
      const x = -6 + ratio * 12;
      setPupil({ x, y: 5 });
      setTilt(x * 0.6);
    }
  }, [value, isFocused, isLoading, isWalking]);

  // Tiny squash bounce per keystroke burst
  useEffect(() => {
    if (isFocused && value.length !== prevLen.current) {
      setPulse(true);
      clearTimeout(pulseTimer.current);
      pulseTimer.current = setTimeout(() => setPulse(false), 200);
      armIdleTimers();
      setIdleStage('none');
      // Every so often, celebrate the typing with a little trick
      if (Date.now() - trickCooldown.current > 7000 && Math.random() < 0.16) {
        trickCooldown.current = Date.now();
        const t = ['jump', 'flip', 'emoji'][Math.floor(Math.random() * 3)];
        setTrick(t);
        clearTimeout(trickTimer.current);
        trickTimer.current = setTimeout(() => setTrick(null), t === 'emoji' ? 1400 : 900);
      }
    }
    prevLen.current = value.length;
  }, [value, isFocused]); // eslint-disable-line react-hooks/exhaustive-deps

  const busy = isLoading || isWalking;
  const sleeping = idleStage === 'sleep' && !isFocused && !busy;
  const crying = idleStage === 'cry' && !busy;

  // Speech bubble: a few personality lines, never spammy
  const [bubble, setBubble] = useState(null);
  const bubbleTimer = useRef(null);
  const saidWelcome = useRef(false);
  const saidTyping = useRef(false);
  const say = (text, ms = 3400) => {
    setBubble(text);
    clearTimeout(bubbleTimer.current);
    bubbleTimer.current = setTimeout(() => setBubble(null), ms);
  };
  useEffect(() => {
    if (isFocused && !saidWelcome.current) {
      saidWelcome.current = true;
      say(userName
        ? `Welcome back, ${userName}! Ninja designer, at your service 🥷`
        : "Ninja designer, at your service 🥷");
    }
  }, [isFocused]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isFocused && value.length > 8 && !saidTyping.current) {
      saidTyping.current = true;
      say('Ooh… I like where this is going.');
    }
  }, [value, isFocused]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isLoading) say('On it! Sharpening my pixels ⚡', 4200);
  }, [isLoading]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (crying) say("Psst… type something, I miss you 🥺", 3800);
  }, [crying]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isWalking) say('Wheee!', 1300);
    return () => clearTimeout(bubbleTimer.current);
  }, [isWalking]); // eslint-disable-line react-hooks/exhaustive-deps

  // Random blinking (double-blink sometimes — reads as alive)
  useEffect(() => {
    const schedule = () => {
      blinkTimer.current = setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => setIsBlinking(false), 140);
        if (Math.random() < 0.25) {
          setTimeout(() => {
            setIsBlinking(true);
            setTimeout(() => setIsBlinking(false), 130);
          }, 260);
        }
        schedule();
      }, 3000 + Math.random() * 4000);
    };
    schedule();
    return () => clearTimeout(blinkTimer.current);
  }, []);

  // Left alone: teary at 18s, asleep at 38s — any activity resets
  const armIdleTimers = () => {
    clearTimeout(cryTimer.current);
    clearTimeout(sleepTimer.current);
    cryTimer.current = setTimeout(() => setIdleStage('cry'), 18000);
    sleepTimer.current = setTimeout(() => setIdleStage('sleep'), 38000);
  };
  useEffect(() => {
    armIdleTimers();
    return () => {
      clearTimeout(cryTimer.current);
      clearTimeout(sleepTimer.current);
      clearTimeout(trickTimer.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (isFocused || isLoading || isWalking) {
      setIdleStage('none');
      armIdleTimers();
    }
  }, [isFocused, isLoading, isWalking]); // eslint-disable-line react-hooks/exhaustive-deps

  const excited = (isFocused && pulse) || isWalking;
  const mouth = sleeping ? 'o'
    : crying ? 'sad'
    : isLoading ? 'determined'
    : (isHovered || isWalking || (isFocused && value.length > 0)) ? 'open'
    : 'smile';

  const cls = [
    'ninja-blob-container',
    isFocused ? 'is-focused' : '',
    isLoading ? 'is-loading' : '',
    isWalking ? 'is-walking' : '',
    sleeping ? 'is-sleepy' : '',
    crying ? 'is-crying' : '',
    trick ? `trick-${trick}` : '',
    isHovered ? 'is-hovered' : '',
    isNear ? 'is-near' : '',
    pulse ? 'nb-pulse' : '',
    `side-${side}`
  ].filter(Boolean).join(' ');

  return (
    <div ref={containerRef} className={cls}>
      <div className="nb-bob" style={{ '--nb-tilt': `${tilt}deg` }}>
        <svg viewBox="0 0 150 140" className="nb-svg" aria-hidden="true">
          <defs>
            <radialGradient id="nbBody" cx="42%" cy="34%" r="72%">
              <stop offset="0%" stopColor="#EBD6FC" />
              <stop offset="45%" stopColor="#D2ACF6" />
              <stop offset="78%" stopColor="#B784EC" />
              <stop offset="100%" stopColor="#8A4CD2" />
            </radialGradient>
            <filter id="nbSoft" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="7" />
            </filter>
            <filter id="nbBlur2" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="2.4" />
            </filter>
            <clipPath id="nbEyeClipL"><ellipse cx="61" cy="88" rx="12.5" ry="14" /></clipPath>
            <clipPath id="nbEyeClipR"><ellipse cx="89" cy="88" rx="12.5" ry="14" /></clipPath>
          </defs>

          {/* soft halo (subtle) */}
          <ellipse cx="75" cy="80" rx="47" ry="45" fill="#B57FE8" opacity="0.22" filter="url(#nbSoft)" />
          {/* body */}
          <ellipse cx="75" cy="79" rx="50" ry="48" fill="url(#nbBody)" />
          {/* grounded core shadow (3D) */}
          <ellipse cx="75" cy="116" rx="36" ry="11" fill="#6E3BAD" opacity="0.35" filter="url(#nbBlur2)" />
          {/* rim light along the lower-right edge (3D) */}
          <path d="M 108 105 A 50 48 0 0 0 122 76" fill="none" stroke="#E6CDFB" strokeWidth="3" strokeLinecap="round" opacity="0.5" filter="url(#nbBlur2)" />
          {/* top-left sheen */}
          <ellipse cx="58" cy="52" rx="20" ry="12" fill="#FFFFFF" opacity="0.4" filter="url(#nbBlur2)" />
          <ellipse cx="52" cy="47" rx="8" ry="4.5" fill="#FFFFFF" opacity="0.65" filter="url(#nbBlur2)" />

          {/* ninja headband */}
          <g className="nb-headband">
            <path d="M 28 56 Q 75 40 122 56" fill="none" stroke="#322A4E" strokeWidth="15" strokeLinecap="round" />
            <path d="M 30 52.5 Q 75 37 120 52.5" fill="none" stroke="#4A3F6E" strokeWidth="3.5" strokeLinecap="round" opacity="0.9" />
            <circle cx="121" cy="55" r="7.5" fill="#322A4E" />
            <g className="nb-tails">
              <path className="nb-tail nb-tail-1" d="M 124 52 Q 146 44 149 54 Q 138 60 126 58 Z" fill="#322A4E" />
              <path className="nb-tail nb-tail-2" d="M 124 58 Q 144 64 145 74 Q 133 72 124 63 Z" fill="#2A2340" />
            </g>
          </g>

          {/* eyebrows */}
          <path className="nb-brow nb-brow-l" d="M 52 68 Q 61 63 69 66" fill="none" stroke="#231A38" strokeWidth="4.5" strokeLinecap="round" />
          <path className="nb-brow nb-brow-r" d="M 81 66 Q 89 63 98 68" fill="none" stroke="#231A38" strokeWidth="4.5" strokeLinecap="round" />

          {/* eyes */}
          <g className="nb-eyes">
            <g className="nb-eye nb-eye-l">
              <ellipse cx="61" cy="88" rx="12.5" ry="14" fill="#FFFFFF" stroke="#231A38" strokeWidth="2.5" />
              <g clipPath="url(#nbEyeClipL)">
                <g className="nb-pupils" style={{ transform: `translate(${pupil.x}px, ${pupil.y}px)` }}>
                  <circle cx="61" cy="89" r="7.5" fill="#1D1430" />
                  <circle cx="58.6" cy="85.8" r="2.8" fill="#FFFFFF" />
                  <circle cx="63.6" cy="91.4" r="1.3" fill="#FFFFFF" opacity="0.9" />
                </g>
                <ellipse className="nb-lid" cx="61" cy="80" rx="13.5" ry="15" fill="#C39BF0"
                  style={{ transform: `translateY(${isBlinking ? 8 : sleeping ? 4 : -26}px)` }} />
              </g>
            </g>
            <g className="nb-eye nb-eye-r">
              <ellipse cx="89" cy="88" rx="12.5" ry="14" fill="#FFFFFF" stroke="#231A38" strokeWidth="2.5" />
              <g clipPath="url(#nbEyeClipR)">
                <g className="nb-pupils" style={{ transform: `translate(${pupil.x}px, ${pupil.y}px)` }}>
                  <circle cx="89" cy="89" r="7.5" fill="#1D1430" />
                  <circle cx="86.6" cy="85.8" r="2.8" fill="#FFFFFF" />
                  <circle cx="91.6" cy="91.4" r="1.3" fill="#FFFFFF" opacity="0.9" />
                </g>
                <ellipse className="nb-lid" cx="89" cy="80" rx="13.5" ry="15" fill="#C39BF0"
                  style={{ transform: `translateY(${isBlinking ? 8 : sleeping ? 4 : -26}px)` }} />
              </g>
            </g>
          </g>

          {/* blush */}
          <ellipse className="nb-blush" cx="47" cy="102" rx="7" ry="4" fill="#FF8FB1" opacity="0.55" filter="url(#nbBlur2)" />
          <ellipse className="nb-blush" cx="103" cy="102" rx="7" ry="4" fill="#FF8FB1" opacity="0.55" filter="url(#nbBlur2)" />

          {/* mouth variants */}
          {mouth === 'smile' && (
            <path d="M 68 104 Q 75 110 82 104" fill="none" stroke="#231A38" strokeWidth="3.5" strokeLinecap="round" />
          )}
          {mouth === 'open' && (
            <path d="M 66 103 Q 75 116 84 103 Q 75 108 66 103 Z" fill="#3A2B4F" />
          )}
          {mouth === 'determined' && (
            <path d="M 68 106 L 82 105" fill="none" stroke="#231A38" strokeWidth="3.5" strokeLinecap="round" />
          )}
          {mouth === 'o' && (
            <circle cx="75" cy="106" r="3" fill="#3A2B4F" />
          )}
          {mouth === 'sad' && (
            <path d="M 67 109 Q 75 102 83 109" fill="none" stroke="#231A38" strokeWidth="3.5" strokeLinecap="round" />
          )}

          {crying && (
            <g className="nb-tears">
              <ellipse className="nb-tear nb-tear-1" cx="52" cy="105" rx="2.8" ry="4.2" fill="#8FD0FF" />
              <ellipse className="nb-tear nb-tear-2" cx="98" cy="105" rx="2.8" ry="4.2" fill="#8FD0FF" />
            </g>
          )}

          {/* excitement marks */}
          <g className="nb-marks" opacity={excited ? 1 : 0}>
            <path d="M 60 20 L 56 10" stroke="#231A38" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M 75 17 L 75 6" stroke="#231A38" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M 90 20 L 94 10" stroke="#231A38" strokeWidth="3.5" strokeLinecap="round" />
          </g>

          {/* little paws resting on the bar */}
          <g className="nb-paws">
            <ellipse cx="58" cy="124" rx="9" ry="6.5" fill="#B784EC" />
            <ellipse cx="92" cy="124" rx="9" ry="6.5" fill="#B784EC" />
          </g>
        </svg>

        {bubble && <div className="nb-bubble">{bubble}</div>}

        {trick === 'emoji' && (
          <div className="nb-emoji" aria-hidden="true">
            <span>✨</span><span>🔥</span><span>💜</span>
          </div>
        )}

        {/* sleepy Zzz */}
        {sleeping && (
          <div className="nb-zzz" aria-hidden="true">
            <span>z</span><span>Z</span><span>z</span>
          </div>
        )}
      </div>
    </div>
  );
}
