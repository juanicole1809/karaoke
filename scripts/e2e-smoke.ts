// End-to-end smoke test: resolve song → create room via WS → add video → verify queue.
const API = 'http://localhost:4000';
const WS_URL = 'ws://localhost:4000/ws';

function wsMessage(type: string, extra: Record<string, unknown> = {}) {
    return JSON.stringify({
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        deviceId: `test-${Math.random().toString(36).slice(2, 10)}`,
        type,
        ...extra,
    });
}

async function main() {
    // 1. Resolve a song request.
    const res = await fetch(`${API}/api/vkara/song-request`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: 'Persiana Americana - Soda Stereo' }),
    });
    const data = (await res.json()) as any;
    const top = data.candidates?.[0];
    if (!top) throw new Error('No candidates');
    console.log(`Resolved: ${top.video.title} (${Math.round(top.confidence * 100)}%)`);

    // 2. Create room over WebSocket.
    const ws = new WebSocket(WS_URL);
    const received: any[] = [];
    const waitFor = (predicate: (m: any) => boolean, timeoutMs = 8000) =>
        new Promise<any>((resolve, reject) => {
            const deadline = Date.now() + timeoutMs;
            const timer = setInterval(() => {
                const idx = received.findIndex(predicate);
                if (idx !== -1) {
                    clearInterval(timer);
                    resolve(received.splice(idx, 1)[0]);
                } else if (Date.now() > deadline) {
                    clearInterval(timer);
                    reject(new Error('timeout waiting for message'));
                }
            }, 50);
        });

    await new Promise<void>((resolve) => (ws.onopen = () => resolve()));
    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data as string);
        received.push(msg);
    };

    ws.send(wsMessage('createRoom', { displayName: 'TestHost' }));
    const created = await waitFor((m) => m.type === 'roomCreated');
    const roomId = created.roomId;
    console.log('Room created:', roomId);

    // 3. Add the resolved video to the queue.
    ws.send(wsMessage('addVideo', { video: top.video }));
    const state = await waitFor((m) => m.type === 'roomUpdate' && (m.room?.videoQueue?.length > 0 || m.room?.playingNow));
    const room = state.room ?? state;
    const queueLen = room.videoQueue?.length ?? 0;
    const playing = room.playingNow?.title ?? room.playingNow?.video?.title ?? 'none';
    console.log(`Queue after add → playingNow="${playing}" | videoQueue.length=${queueLen}`);

    ws.close();
    console.log(queueLen > 0 || playing !== 'none' ? '✅ FLOW OK' : '❌ FLOW FAILED');
    process.exit(0);
}

main().catch((error) => {
    console.error('❌', error);
    process.exit(1);
});