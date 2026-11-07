import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {
  channelStyleSchema,
  templateManifestSchema,
  videoProjectSchema,
  validateVideoProjectIdentity,
  resolveTemplateVariables,
} from '../src/production/identity';

const style = {
  schemaVersion: 1,
  channelId: 'systems-explained',
  revision: 1,
  displayName: 'Systems Explained',
  visual: {
    palette: {background: '#10191c', foreground: '#f0eee6', accent: '#efbd73'},
    typography: {
      displayFont: 'Georgia',
      bodyFont: 'Arial',
      minimumReadablePxAt1080p: 44,
    },
    motion: 'restrained',
    chromePolicy: 'only-when-demonstrating-ui',
  },
  characters: [
    {
      id: 'network-mascot',
      name: 'Network mascot',
      referenceAssetIds: ['mascot-reference-v1'],
      identityNotes: 'Always use the approved reference sheet; preserve proportions.',
    },
  ],
};
const template = {
  schemaVersion: 1,
  id: 'kinetic-text-highlight',
  version: '1.0.0',
  title: 'Kinetic text highlight',
  category: 'kinetic-type',
  renderer: 'hyperframes',
  entry: 'index.html',
  license: 'Apache-2.0',
  parameters: [
    {key: 'headline', kind: 'text', required: true},
    {key: 'highlight', kind: 'text', required: true},
  ],
  channelStyleInputs: ['accent', 'background', 'foreground', 'displayFont'],
};
const video = {
  schemaVersion: 1,
  id: 'how-http-works',
  title: 'How an HTTP request travels',
  style: {channelId: 'systems-explained', revision: 1},
  scriptPath: 'script.md',
  voicePath: 'audio/narration.wav',
  storyboardPath: 'storyboard.json',
  templatePins: [{id: 'kinetic-text-highlight', version: '1.0.0'}],
};

test('channel style, character reference and project pins validate', () => {
  const result = validateVideoProjectIdentity(video, style, [template]);
  assert.equal(result.style.visual.motion, 'restrained');
  assert.equal(result.project.style.revision, 1);
  assert.equal(result.style.characters[0].referenceAssetIds[0], 'mascot-reference-v1');
});

test('video cannot silently inherit a newer channel style revision', () => {
  assert.throws(
    () => validateVideoProjectIdentity(video, {...style, revision: 2}, [template]),
    /Video project references channel style/,
  );
  assert.throws(
    () => validateVideoProjectIdentity(video, {...style, channelId: 'different-channel'}, [template]),
    /Video project references channel style/,
  );
});

test('video cannot use an unavailable template version', () => {
  assert.throws(
    () => validateVideoProjectIdentity(video, style, [{...template, version: '2.0.0'}]),
    /Missing pinned template/,
  );
  assert.equal(videoProjectSchema.safeParse({
    ...video, templatePins: [video.templatePins[0], video.templatePins[0]],
  }).success, false);
});

test('style rejects duplicate characters or reference sheets', () => {
  assert.equal(channelStyleSchema.safeParse({
    ...style,
    characters: [style.characters[0], style.characters[0]],
  }).success, false);
  assert.equal(channelStyleSchema.safeParse({
    ...style,
    characters: [{...style.characters[0], referenceAssetIds: [
      'mascot-reference-v1', 'mascot-reference-v1',
    ]}],
  }).success, false);
});

test('template is declarative and needs valid input bindings and a safe entry path', () => {
  assert.equal(templateManifestSchema.safeParse({
    ...template, entry: '../../secrets/private.html',
  }).success, false);
  assert.equal(templateManifestSchema.safeParse({
    ...template,
    parameters: [template.parameters[0], template.parameters[0]],
  }).success, false);
  assert.equal(templateManifestSchema.safeParse({
    ...template,
    channelStyleInputs: ['accent', 'accent'],
  }).success, false);
});

test('all media paths remain local relative references', () => {
  assert.equal(videoProjectSchema.safeParse({
    ...video, voicePath: 'C:/Users/secret.wav',
  }).success, false);
  assert.equal(videoProjectSchema.safeParse({
    ...video, scriptPath: '../private/script.md',
  }).success, false);
  assert.equal(videoProjectSchema.safeParse({
    ...video, storyboardPath: '/etc/passwd',
  }).success, false);
});


test('template variables inherit brand identity but permit content overrides', () => {
  const resolved = resolveTemplateVariables(
    channelStyleSchema.parse(style),
    templateManifestSchema.parse(template),
    {headline: 'Hello', highlight: 'The idea'},
  );
  assert.deepEqual(resolved, {
    headline: 'Hello',
    highlight: 'The idea',
    channelBackground: '#10191c',
    channelForeground: '#f0eee6',
    channelAccent: '#efbd73',
    channelDisplayFont: 'Georgia',
  });
  assert.throws(
    () => resolveTemplateVariables(
      channelStyleSchema.parse(style),
      templateManifestSchema.parse(template),
      {headline: 'Hello', highlight: 'Idea', channelAccent: '#ff0000'},
    ),
    /Undeclared template parameter/,
  );
  assert.throws(
    () => resolveTemplateVariables(
      channelStyleSchema.parse(style),
      templateManifestSchema.parse(template),
      {headline: 'Hello'},
    ),
    /Missing required template parameter/,
  );
});

test('template manifest cannot hijack reserved channel variables', () => {
  assert.equal(templateManifestSchema.safeParse({
    ...template,
    parameters: [{key: 'channelAccent', kind: 'color', required: true}],
  }).success, false);
});

test('shipped fixture exports valid HyperFrames render variables', () => {
  const result = spawnSync(process.execPath, [
    '--import', 'tsx', 'scripts/template-variables.ts',
    'examples/identity/channel.style.json',
    'examples/templates/text-highlight/template.template.json',
    'examples/templates/text-highlight/inputs.json',
  ], {encoding: 'utf8'});

  assert.equal(result.status, 0, result.stderr);
  const variables = JSON.parse(result.stdout) as Record<string, unknown>;
  assert.equal(variables.channelAccent, '#efbd73');
  assert.equal(variables.headline, 'One small click.');
  assert.equal(variables.highlight, 'One big journey.');
});
