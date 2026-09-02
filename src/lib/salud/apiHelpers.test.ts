import { test } from 'node:test';
import assert from 'node:assert/strict';
import { errMsg, numOrNull } from './apiHelpers.ts';

test('errMsg: extracts message from Error instance', () => {
  const err = new Error('test error');
  assert.equal(errMsg(err), 'test error');
});

test('errMsg: extracts message from object with message property', () => {
  const err = { message: 'custom error message' };
  assert.equal(errMsg(err), 'custom error message');
});

test('errMsg: returns default message for object without message property', () => {
  const err = { foo: 'bar' };
  assert.equal(errMsg(err), 'error desconocido');
});

test('errMsg: returns default message for string', () => {
  const err = 'just a string';
  assert.equal(errMsg(err), 'error desconocido');
});

test('errMsg: returns default message for null or undefined', () => {
  assert.equal(errMsg(null), 'error desconocido');
  assert.equal(errMsg(undefined), 'error desconocido');
});

test('numOrNull: returns null for undefined, null, or empty string', () => {
  assert.equal(numOrNull(undefined), null);
  assert.equal(numOrNull(null), null);
  assert.equal(numOrNull(''), null);
});

test('numOrNull: returns number for valid number inputs', () => {
  assert.equal(numOrNull(42), 42);
  assert.equal(numOrNull(0), 0);
  assert.equal(numOrNull(-3.14), -3.14);
});

test('numOrNull: returns number for valid string inputs', () => {
  assert.equal(numOrNull('42'), 42);
  assert.equal(numOrNull('0'), 0);
  assert.equal(numOrNull('-3.14'), -3.14);
});

test('numOrNull: returns null for invalid number inputs (NaN, Infinity, non-numeric strings)', () => {
  assert.equal(numOrNull(NaN), null);
  assert.equal(numOrNull(Infinity), null);
  assert.equal(numOrNull(-Infinity), null);
  assert.equal(numOrNull('abc'), null);
  assert.equal(numOrNull('42abc'), null);
  assert.equal(numOrNull({}), null);
});
