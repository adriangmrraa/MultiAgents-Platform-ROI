/**
 * Future Platform — Voice Widget SDK v1.0
 * Embeddable voice assistant widget for Tienda Nube stores.
 * Zero dependencies, Shadow DOM encapsulated, < 30KB gzipped.
 */
(function () {
    'use strict';

    var script = document.currentScript;
    if (!script) return;

    var token = script.dataset.token;
    if (!token) return;

    var API_BASE = script.src.replace('/static/voice-widget-sdk.js', '');

    // --- State ---
    var state = 'idle'; // idle | connecting | active | error | blocked | minutes_exhausted
    var config = null;
    var sessionId = null;
    var ws = null;
    var mediaStream = null;
    var audioContext = null;
    var callTimer = null;
    var callSeconds = 0;

    // --- Fetch Config ---
    fetch(API_BASE + '/public/voice-widget/' + token)
        .then(function (r) {
            if (!r.ok) return null;
            return r.json();
        })
        .then(function (data) {
            if (!data) return;
            config = data;
            renderWidget();
        })
        .catch(function () { /* silently fail */ });

    // --- Render ---
    function renderWidget() {
        var host = document.createElement('div');
        host.id = 'future-voice-widget';
        var shadow = host.attachShadow({ mode: 'closed' });

        // Styles
        var style = document.createElement('style');
        style.textContent = getStyles();
        shadow.appendChild(style);

        // Container
        var container = document.createElement('div');
        container.className = 'fvw-container fvw-' + (config.button_position || 'bottom-right');
        shadow.appendChild(container);

        // Welcome bubble
        var bubble = document.createElement('div');
        bubble.className = 'fvw-bubble';
        bubble.textContent = config.welcome_message || '';
        container.appendChild(bubble);

        // Main button
        var btn = document.createElement('button');
        btn.className = 'fvw-btn fvw-btn-' + (config.button_size || 'md');
        btn.style.backgroundColor = config.brand_color || '#8B5CF6';
        btn.innerHTML = getIconSvg(config.button_icon || 'phone');
        btn.setAttribute('aria-label', 'Hablar con asistente de voz');
        container.appendChild(btn);

        // Call overlay
        var overlay = document.createElement('div');
        overlay.className = 'fvw-overlay fvw-hidden';
        overlay.innerHTML =
            '<div class="fvw-overlay-inner">' +
            '<div class="fvw-status">Conectando...</div>' +
            '<div class="fvw-timer">00:00</div>' +
            '<div class="fvw-waveform"><span></span><span></span><span></span><span></span><span></span></div>' +
            '<button class="fvw-hangup">Colgar</button>' +
            '</div>';
        container.appendChild(overlay);

        // Blocked overlay
        var blockedEl = document.createElement('div');
        blockedEl.className = 'fvw-blocked fvw-hidden';
        var waNum = config.whatsapp_number || '';
        var waLink = waNum ? 'https://wa.me/' + waNum.replace(/[^0-9]/g, '') : '#';
        blockedEl.innerHTML =
            '<div class="fvw-blocked-inner">' +
            '<p class="fvw-blocked-title">Llamada finalizada</p>' +
            '<p class="fvw-blocked-text">Si necesitas ayuda con nuestros productos, escr\u00edbenos por WhatsApp.</p>' +
            '<a class="fvw-wa-btn" href="' + waLink + '" target="_blank" rel="noopener">Hablar por WhatsApp</a>' +
            '</div>';
        container.appendChild(blockedEl);

        // --- Event Handlers ---
        btn.addEventListener('click', function () {
            if (state === 'idle') {
                startCall(shadow);
            }
        });

        overlay.querySelector('.fvw-hangup').addEventListener('click', function () {
            endCall(shadow);
        });

        document.body.appendChild(host);

        // Auto-hide bubble after 5s
        setTimeout(function () {
            bubble.classList.add('fvw-bubble-hide');
        }, 5000);
    }

    // --- Call Flow ---
    function startCall(shadow) {
        setState(shadow, 'connecting');

        // Request microphone
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setState(shadow, 'error');
            return;
        }

        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(function (stream) {
                mediaStream = stream;
                return createSession();
            })
            .then(function (session) {
                if (!session) {
                    setState(shadow, 'error');
                    return;
                }
                sessionId = session.session_id;
                connectWebSocket(shadow, session.ws_url, session.max_duration);
            })
            .catch(function (err) {
                console.warn('[FutureVoice] Mic denied or session failed:', err);
                if (err && err.message === 'blocked_abuse') {
                    setState(shadow, 'blocked');
                } else if (err && err.message === 'minutes_exhausted') {
                    setState(shadow, 'minutes_exhausted');
                } else {
                    setState(shadow, 'error');
                }
            });
    }

    function createSession() {
        return fetch(API_BASE + '/public/voice-widget/' + token + '/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }).then(function (r) {
            if (r.status === 403) {
                return r.json().then(function (data) {
                    throw new Error(data.detail || 'forbidden');
                });
            }
            if (r.status === 429) throw new Error('rate_limited');
            if (!r.ok) throw new Error('session_failed');
            return r.json();
        });
    }

    function connectWebSocket(shadow, wsUrl, maxDuration) {
        ws = new WebSocket(wsUrl);
        ws.binaryType = 'arraybuffer';

        ws.onopen = function () {
            setState(shadow, 'active');
            startTimer(shadow, maxDuration);
            startAudioCapture();
        };

        ws.onmessage = function (evt) {
            if (evt.data instanceof ArrayBuffer) {
                playAudio(evt.data);
            }
        };

        ws.onclose = function (evt) {
            if (evt.code === 4003) {
                setState(shadow, 'blocked');
            } else if (evt.code === 4004) {
                setState(shadow, 'minutes_exhausted');
            } else {
                endCall(shadow);
            }
        };

        ws.onerror = function () {
            endCall(shadow);
        };
    }

    function startAudioCapture() {
        if (!mediaStream) return;
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
            var source = audioContext.createMediaStreamSource(mediaStream);
            var processor = audioContext.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = function (e) {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    var input = e.inputBuffer.getChannelData(0);
                    var pcm16 = new Int16Array(input.length);
                    for (var i = 0; i < input.length; i++) {
                        pcm16[i] = Math.max(-32768, Math.min(32767, input[i] * 32768));
                    }
                    ws.send(pcm16.buffer);
                }
            };
            source.connect(processor);
            processor.connect(audioContext.destination);
        } catch (e) {
            console.warn('[FutureVoice] Audio capture error:', e);
        }
    }

    function playAudio(arrayBuffer) {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        try {
            // PCM16 raw playback
            var pcm16 = new Int16Array(arrayBuffer);
            var float32 = new Float32Array(pcm16.length);
            for (var i = 0; i < pcm16.length; i++) {
                float32[i] = pcm16[i] / 32768;
            }
            var buffer = audioContext.createBuffer(1, float32.length, 16000);
            buffer.getChannelData(0).set(float32);
            var src = audioContext.createBufferSource();
            src.buffer = buffer;
            src.connect(audioContext.destination);
            src.start();
        } catch (e) {
            console.warn('[FutureVoice] Playback error:', e);
        }
    }

    function startTimer(shadow, maxDuration) {
        callSeconds = 0;
        var timerEl = shadow.querySelector('.fvw-timer');
        callTimer = setInterval(function () {
            callSeconds++;
            if (timerEl) {
                var m = Math.floor(callSeconds / 60);
                var s = callSeconds % 60;
                timerEl.textContent = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
            }
            if (maxDuration && callSeconds >= maxDuration) {
                endCall(shadow);
            }
        }, 1000);
    }

    function endCall(shadow) {
        if (callTimer) { clearInterval(callTimer); callTimer = null; }
        if (ws) { try { ws.close(); } catch (e) { } ws = null; }
        if (mediaStream) { mediaStream.getTracks().forEach(function (t) { t.stop(); }); mediaStream = null; }
        if (audioContext) { try { audioContext.close(); } catch (e) { } audioContext = null; }
        setState(shadow, 'idle');
    }

    function setState(shadow, newState) {
        state = newState;
        var overlay = shadow.querySelector('.fvw-overlay');
        var blocked = shadow.querySelector('.fvw-blocked');
        var btn = shadow.querySelector('.fvw-btn');
        var statusEl = shadow.querySelector('.fvw-status');

        if (overlay) overlay.classList.add('fvw-hidden');
        if (blocked) blocked.classList.add('fvw-hidden');
        if (btn) btn.classList.remove('fvw-pulse');

        switch (newState) {
            case 'connecting':
                if (overlay) overlay.classList.remove('fvw-hidden');
                if (statusEl) statusEl.textContent = 'Conectando...';
                if (btn) btn.classList.add('fvw-pulse');
                break;
            case 'active':
                if (overlay) overlay.classList.remove('fvw-hidden');
                if (statusEl) statusEl.textContent = 'En llamada';
                break;
            case 'blocked':
            case 'minutes_exhausted':
                if (blocked) {
                    blocked.classList.remove('fvw-hidden');
                    var title = blocked.querySelector('.fvw-blocked-title');
                    var text = blocked.querySelector('.fvw-blocked-text');
                    if (newState === 'minutes_exhausted') {
                        if (title) title.textContent = 'Minutos agotados';
                        if (text) text.textContent = 'Los minutos de voz se agotaron este mes. Cont\u00e1ctanos por WhatsApp.';
                    }
                }
                break;
            case 'error':
                if (overlay) overlay.classList.remove('fvw-hidden');
                if (statusEl) statusEl.textContent = 'Error de conexi\u00f3n';
                setTimeout(function () { setState(shadow, 'idle'); }, 3000);
                break;
        }
    }

    // --- Helpers ---
    function getIconSvg(icon) {
        if (icon === 'mic') return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>';
        if (icon === 'headset') return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>';
        return '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
    }

    function getStyles() {
        return [
            '.fvw-container { position: fixed; z-index: 999999; display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }',
            '.fvw-bottom-right { bottom: 20px; right: 20px; }',
            '.fvw-bottom-left { bottom: 20px; left: 20px; align-items: flex-start; }',
            '.fvw-btn { border: none; border-radius: 50%; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 20px rgba(0,0,0,0.3); transition: transform 0.2s, box-shadow 0.2s; }',
            '.fvw-btn:hover { transform: scale(1.1); box-shadow: 0 6px 30px rgba(0,0,0,0.4); }',
            '.fvw-btn-sm { width: 48px; height: 48px; }',
            '.fvw-btn-md { width: 56px; height: 56px; }',
            '.fvw-btn-lg { width: 64px; height: 64px; }',
            '.fvw-pulse { animation: fvw-pulse 1.5s ease-in-out infinite; }',
            '@keyframes fvw-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(139,92,246,0.4); } 50% { box-shadow: 0 0 0 15px rgba(139,92,246,0); } }',
            '.fvw-bubble { background: white; color: #1a1a1a; font-size: 13px; padding: 8px 14px; border-radius: 16px 16px 4px 16px; box-shadow: 0 2px 10px rgba(0,0,0,0.15); max-width: 180px; transition: opacity 0.3s, transform 0.3s; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }',
            '.fvw-bubble-hide { opacity: 0; transform: translateY(10px); pointer-events: none; }',
            '.fvw-overlay { position: fixed; bottom: 20px; right: 20px; background: #18181b; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 24px; min-width: 200px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); font-family: -apple-system, BlinkMacSystemFont, sans-serif; }',
            '.fvw-overlay-inner { display: flex; flex-direction: column; align-items: center; gap: 12px; }',
            '.fvw-status { color: #a1a1aa; font-size: 13px; }',
            '.fvw-timer { color: white; font-size: 24px; font-weight: bold; font-variant-numeric: tabular-nums; }',
            '.fvw-waveform { display: flex; gap: 3px; align-items: center; height: 20px; }',
            '.fvw-waveform span { width: 3px; background: #8B5CF6; border-radius: 2px; animation: fvw-wave 0.8s ease-in-out infinite; }',
            '.fvw-waveform span:nth-child(1) { height: 8px; animation-delay: 0s; }',
            '.fvw-waveform span:nth-child(2) { height: 16px; animation-delay: 0.1s; }',
            '.fvw-waveform span:nth-child(3) { height: 20px; animation-delay: 0.2s; }',
            '.fvw-waveform span:nth-child(4) { height: 16px; animation-delay: 0.3s; }',
            '.fvw-waveform span:nth-child(5) { height: 8px; animation-delay: 0.4s; }',
            '@keyframes fvw-wave { 0%,100% { transform: scaleY(0.5); } 50% { transform: scaleY(1); } }',
            '.fvw-hangup { background: #ef4444; color: white; border: none; padding: 10px 24px; border-radius: 99px; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.2s; }',
            '.fvw-hangup:hover { background: #dc2626; }',
            '.fvw-blocked { position: fixed; bottom: 20px; right: 20px; background: #18181b; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 24px; min-width: 220px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); font-family: -apple-system, BlinkMacSystemFont, sans-serif; }',
            '.fvw-blocked-inner { text-align: center; }',
            '.fvw-blocked-title { color: #fbbf24; font-size: 15px; font-weight: 700; margin-bottom: 8px; }',
            '.fvw-blocked-text { color: #a1a1aa; font-size: 12px; margin-bottom: 16px; line-height: 1.4; }',
            '.fvw-wa-btn { display: inline-block; background: #25D366; color: white; text-decoration: none; padding: 10px 20px; border-radius: 99px; font-size: 13px; font-weight: 600; transition: background 0.2s; }',
            '.fvw-wa-btn:hover { background: #1da851; }',
            '.fvw-hidden { display: none !important; }'
        ].join('\n');
    }
})();
