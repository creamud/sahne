import assert from 'node:assert/strict';
import test from 'node:test';
import {assetSchema} from '../src/assets/catalog';
import {storyboardSchema, validateNarratedStoryboard} from '../src/production/storyboard';

const transcript = {
  text: 'İstemci isteği gönderir. Sunucu yanıt verir.',
  segments: [
    {start: 0.0, end: 2.0, text: 'İstemci isteği gönderir.'},
    {start: 2.3, end: 5.1, text: 'Sunucu yanıt verir.'},
  ],
};
const audioAsset = assetSchema.parse({
  schemaVersion: 1,
  id: 'click-gentle-v1',
  title: 'Original, quiet test click',
  description: 'Synthetic audio cue only for isolated local tests',
  category: 'audio',
  tags: ['ui', 'click'],
  reviewStatus: 'approved',
  rights: {origin: 'original', clearance: 'cleared', license: 'creator-owned'},
  location: {kind: 'local', relativePath: 'click-gentle-v1/test.wav'},
});
const storyboard = {
  schemaVersion: 1,
  narration: {
    language: 'tr',
    voicePath: 'audio/narration.wav',
    approvedScriptPath: 'script.md',
    transcriptPath: 'transcript.json',
  },
  fps: 30,
  durationMs: 5800,
  beats: [
    {
      id: 'request-beat', startMs: 200, endMs: 1600, cueSegmentIndex: 0,
      treatment: 'overlay', cueText: 'İstek gönderiliyor',
      source: {kind: 'generate', brief: 'Highlight the outgoing network request.'},
    },
    {
      id: 'response-beat', startMs: 2700, endMs: 4700, cueSegmentIndex: 1,
      treatment: 'cutaway', cueText: 'Sunucu yanıtlıyor',
      source: {kind: 'generate', brief: 'Show a successful server response.'},
    },
  ],
  soundCues: [
    {
      id: 'soft-send', assetId: 'click-gentle-v1', atMs: 700,
      durationMs: 250, gainDb: -22, visualBeatId: 'request-beat',
    },
    {
      id: 'soft-reply', assetId: 'click-gentle-v1', atMs: 3200,
      durationMs: 250, gainDb: -18, visualBeatId: 'response-beat',
    },
  ],
} as const;

test('bilingual narration is explicit and both languages may have different SFX timings', () => {
  assert.equal(storyboardSchema.parse(storyboard).narration.language, 'tr');
  const english = {
    ...storyboard,
    narration: {...storyboard.narration, language: 'en'},
    soundCues: storyboard.soundCues.map((cue) => ({
      ...cue, atMs: cue.atMs + 100,
    })),
  };
  assert.equal(storyboardSchema.parse(english).narration.language, 'en');
  assert.notEqual(english.soundCues[0].atMs, storyboard.soundCues[0].atMs);
  assert.equal(
    validateNarratedStoryboard(english, transcript, [audioAsset]).storyboard.soundCues?.length,
    2,
  );
});

test('legacy visual-only storyboards remain valid', () => {
  const {soundCues: _soundCues, ...legacy} = storyboard;
  const {language: _language, ...oldNarration} = legacy.narration;
  assert.equal(storyboardSchema.safeParse({...legacy, narration: oldNarration}).success, true);
});

test('SFX must be rights-cleared approved audio in the catalog', () => {
  assert.doesNotThrow(() => validateNarratedStoryboard(storyboard, transcript, [audioAsset]));
  assert.throws(
    () => validateNarratedStoryboard(storyboard, transcript, []),
    /Sound cue .* references missing asset/,
  );
  assert.throws(
    () => validateNarratedStoryboard(storyboard, transcript, [
      {...audioAsset, category: 'still-image'},
    ]),
    /references non-audio asset/,
  );
  assert.throws(
    () => validateNarratedStoryboard(storyboard, transcript, [
      {...audioAsset, reviewStatus: 'draft'},
    ]),
    /unapproved\/uncleared asset/,
  );
});

test('effect cue times, IDs and gain are validated', () => {
  assert.equal(storyboardSchema.safeParse({
    ...storyboard, soundCues: storyboard.soundCues.map((cue) => ({
      ...cue, gainDb: 0,
    })),
  }).success, false);
  assert.equal(storyboardSchema.safeParse({
    ...storyboard, soundCues: [
      {...storyboard.soundCues[0], atMs: 5700},
    ],
  }).success, false);
  assert.equal(storyboardSchema.safeParse({
    ...storyboard, soundCues: [
      storyboard.soundCues[0], {...storyboard.soundCues[1], id: 'soft-send'},
    ],
  }).success, false);
  assert.equal(storyboardSchema.safeParse({
    ...storyboard, soundCues: [
      {...storyboard.soundCues[0], visualBeatId: 'unknown'},
    ],
  }).success, false);
  assert.equal(storyboardSchema.safeParse({
    ...storyboard, soundCues: [
      {...storyboard.soundCues[0], atMs: 1700},
    ],
  }).success, false);
});
