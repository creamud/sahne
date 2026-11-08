import {readFile} from 'node:fs/promises';
import {storyboardSchema} from '../src/production/storyboard';
import {muxRenderedVisualAndNarration} from '../src/production/mux';

const usage = 'Usage: pnpm video:assemble <storyboard.json> <silent-visual.mp4> ' +
  '<narration-plus-sfx.wav> <final.mp4>';

const main = async () => {
  const [storyboardPath, videoPath, audioPath, outputPath, ...extra] = process.argv.slice(2);
  if (!storyboardPath || !videoPath || !audioPath || !outputPath || extra.length) {
    throw new Error(usage);
  }
  const raw = await readFile(storyboardPath, 'utf8');
  let input: unknown;
  try {
    input = JSON.parse(raw) as unknown;
  } catch (error) {
    throw new Error('Invalid storyboard JSON in ' + storyboardPath + ': ' + String(error));
  }
  const storyboard = storyboardSchema.parse(input);
  const result = await muxRenderedVisualAndNarration({
    videoPath,
    narrationMixPath: audioPath,
    outputPath,
    storyboard,
  });
  console.log(JSON.stringify(result, null, 2));
};

main().catch((error: unknown) => {
  console.error(JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
  }));
  process.exitCode = 1;
});
