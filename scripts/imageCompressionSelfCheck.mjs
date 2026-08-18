import assert from 'node:assert/strict';
import {
  fitImageWithin,
  shouldCompressImage,
} from '../src/utils/imageCompression.mjs';

assert.deepEqual(fitImageWithin(4000, 3000), { width: 1600, height: 1200 });
assert.deepEqual(fitImageWithin(900, 1200), { width: 900, height: 1200 });
assert.equal(shouldCompressImage({ type: 'image/jpeg' }), true);
assert.equal(shouldCompressImage({ type: 'image/gif' }), false);
assert.equal(shouldCompressImage({ type: 'video/mp4' }), false);

console.log('Image compression self-check passed.');
