import { test } from 'node:test';
import assert from 'node:assert/strict';
import { state, reset } from './helpers.mjs';
import { replaceState, defaultState, setSetting } from '../js/core/state.js';

test('Einstellungen wirken nach replaceState (Import/Reset/Neuguss) auf das neue Objekt', () => {
  reset();
  setSetting('particles', false);
  assert.equal(state.settings.particles, false);
  const next = defaultState();
  next.settings.format = 'scientific';
  replaceState(next);
  setSetting('autosaveSec', 30);
  setSetting('particles', false);
  assert.equal(state.settings.autosaveSec, 30);
  assert.equal(state.settings.particles, false);
  assert.equal(state.settings.format, 'scientific');
  assert.equal(next.settings, state.settings);
  reset();
});
