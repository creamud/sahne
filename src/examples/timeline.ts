import sampleProps from '../../examples/two-scenes.json' with {type: 'json'};
import {manifestSchema} from '../manifest';

// The checked-in JSON example is the single source of truth for Studio and CLI.
export const demoManifest = manifestSchema.parse(sampleProps.manifest);
