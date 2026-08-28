// Quick sanity test of the heuristic scoring pipeline.
import { parseDeclaration, scoreCandidates, karaokeSignal } from '../apps/api/src/modules/song-request/scoring';
import type { YouTubeVideo } from '@vkara/youtube';

const sample = (id: string, title: string, channel: string, duration: number, views: number): YouTubeVideo => ({
    id,
    duration,
    duration_formatted: '',
    title,
    type: 'video',
    url: `https://www.youtube.com/watch?v=${id}`,
    uploadedAt: '',
    views,
    channels: [{ name: channel, verified: false }],
    thumbnails: [],
    isLive: false,
});

const videos: YouTubeVideo[] = [
    sample('a1', 'Persiana Americana - Soda Stereo (Karaoke) with lyrics', 'KaraokeZone', 293, 1200000),
    sample('a2', 'Persiana Americana (Official Video) - Soda Stereo', 'Soda Stereo', 293, 80000000),
    sample('a3', 'Soda Stereo - Persiana Americana (En Vivo)', 'SodaStereoLive', 320, 5000000),
    sample('a4', 'Persiana Americana KARAOKE INSTRUMENTAL', 'PistasKaraoke', 300, 85000),
    sample('a5', 'Persiana Americana - Cover Guitarra Tutorial', 'GuitarTutos', 420, 40000),
    sample('a6', 'Persiana Americana AWB', 'RandomGuy', 240, 1200),
    sample('a7', 'Persiana Americana (Letra) - Soda Stereo', 'LyricsEsp', 293, 3000000),
    sample('a8', 'Persiana Americana | Karaoke | Soda Stereo | Pista sin voz', 'TuFiestaKaraoke', 298, 220000),
];

const declaration = parseDeclaration('Persiana Americana - Soda');
console.log('declaration:', JSON.stringify(declaration));

const ranked = scoreCandidates(declaration, videos);
for (const c of ranked) {
    console.log(
        `${(c.confidence * 100).toFixed(0).padStart(3)}% ${c.isKaraoke ? 'KARAOKE' : '     '}  ${c.video.title.slice(0, 60)}  [${c.reasons.join(', ')}]`,
    );
}

console.log('\nkaraokeSignal checks:');
console.log('Karaoke with lyrics →', karaokeSignal('Persiana Americana - Soda Stereo (Karaoke) with lyrics'));
console.log('Official Video →', karaokeSignal('Persiana Americana (Official Video) - Soda Stereo'));
console.log('Pista sin voz →', karaokeSignal('Persiana Americana | Karaoke | Soda Stereo | Pista sin voz'));

// Reversed input: "Soda - Persiana Americana" must still find title matches.
const rev = scoreCandidates(parseDeclaration('Soda Stereo - Persiana Americana'), videos);
console.log('\nReversed declaration top:', rev[0].video.title, (rev[0].confidence * 100).toFixed(0) + '%');