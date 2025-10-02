import { meteoToUV, uvToPixelsPerSecond, bilinearInterpolate } from './math.js';
ṇ
/**
 * Unit tests for math utilities
 * Run with: npm test
 */

const EPSILON = 1e-10;

// Test #1: meteoToUV
console.log('Test #1: meteoToUV(10, 90)');
const result1 = meteoToUV(10, 90);
console.log('Result:', result1);
console.assert(Math.abs(result1.u - (-10)) < EPSILON, `Expected u=-10, got ${result1.u}`);
console.assert(Math.abs(result1.v - 0) < EPSILON, `Expected v=0, got ${result1.v}`);
console.log('✓ Passed');

// Test #2: bilinearInterpolate
console.log('Test #2: bilinearInterpolate(0,10,20,30, 0.25, 0.75)');
const result2 = bilinearInterpolate(0, 10, 20, 30, 0.25, 0.75);
console.log('Result:', result2);
console.assert(Math.abs(result2 - 17.5) < EPSILON, `Expected 17.5, got ${result2}`);
console.log('✓ Passed');

// Test #3: uvToPixelsPerSecond
console.log('Test #3: uvToPixelsPerSecond(-10, 0, 1000)');
const result3 = uvToPixelsPerSecond(-10, 0, 1000);
console.log('Result:', result3);
console.assert(Math.abs(result3.dx - (-0.01)) < EPSILON, `Expected dx=-0.01, got ${result3.dx}`);
console.assert(Math.abs(result3.dy - 0) < EPSILON, `Expected dy=0, got ${result3.dy}`);
console.log('✓ Passed');

console.log('\nAll math tests passed');

import { clamp, lerp, computeParticleTargetCount, expFadeAlpha } from './math.js';

function expectClose(a, b, eps = 1e-6) {
    if (Math.abs(a - b) > eps) throw new Error(`Expected ${a} ≈ ${b}`);
}

// Basic unit checks
(function testClamp() {
    console.log('testClamp');
    console.log('clamp(5, 0, 10):', clamp(5, 0, 10));
    if (clamp(5, 0, 10) !== 5) throw new Error('clamp mid failed');
    console.log('clamp(-1, 0, 10):', clamp(-1, 0, 10));
    if (clamp(-1, 0, 10) !== 0) throw new Error('clamp low failed');
    console.log('clamp(11, 0, 10):', clamp(11, 0, 10));
    if (clamp(11, 0, 10) !== 10) throw new Error('clamp high failed');
    console.log('✓ Passed');
})();

(function testLerp() {
    console.log('testLerp');
    console.log('lerp(0, 10, 0.5):', lerp(0, 10, 0.5));
    expectClose(lerp(0, 10, 0.5), 5);
    console.log('lerp(2, 4, 0.25):', lerp(2, 4, 0.25));
    expectClose(lerp(2, 4, 0.25), 2.5);
    console.log('✓ Passed');
})();

(function testDensity() {
    console.log('testDensity');
    const vp = 1920 * 1080;
    const d = 0.002;
    const target = computeParticleTargetCount(vp, d, 1000, 8000);
    console.log('computeParticleTargetCount:', target);
    if (target < 1000 || target > 8000) throw new Error('density clamp failed');
    console.log('✓ Passed');
})();

(function testFade() {
    console.log('testFade');
    const dt = 1 / 60;
    const pxPerSec = 100;
    const desired = 100; // target ~1s persistence
    const alpha = expFadeAlpha(dt, pxPerSec, desired);
    console.log('expFadeAlpha:', alpha);
    if (alpha <= 0 || alpha >= 1) throw new Error('fade alpha bounds failed');
    console.log('✓ Passed');
})();

import { clamp, lerp, toRad, kmhToMs, dirFromDegSpeedMsToUV } from './math.js';

function expectClose(a, b, eps = 1e-6) {
    if (Math.abs(a - b) > eps) throw new Error(`Expected ${a} ≈ ${b}`);
}

(function testClamp() {
    console.log('testClamp (second set)');
    console.log('clamp(-1, 0, 10):', clamp(-1, 0, 10));
    if (clamp(-1, 0, 10) !== 0) throw new Error('clamp low failed');
    console.log('clamp(11, 0, 10):', clamp(11, 0, 10));
    if (clamp(11, 0, 10) !== 10) throw new Error('clamp high failed');
    console.log('clamp(5, 0, 10):', clamp(5, 0, 10));
    if (clamp(5, 0, 10) !== 5) throw new Error('clamp mid failed');
    console.log('✓ Passed');
})();

(function testLerp() {
    console.log('testLerp (second set)');
    console.log('lerp(0, 10, 0.25):', lerp(0, 10, 0.25));
    expectClose(lerp(0, 10, 0.25), 2.5);
    console.log('lerp(2, 4, 0.5):', lerp(2, 4, 0.5));
    expectClose(lerp(2, 4, 0.5), 3);
    console.log('✓ Passed');
})();

(function testToRad() {
    console.log('testToRad');
    console.log('toRad(180):', toRad(180));
    expectClose(toRad(180), Math.PI);
    console.log('toRad(90):', toRad(90));
    expectClose(toRad(90), Math.PI / 2);
    console.log('✓ Passed');
})();

(function testKmhToMs() {
    console.log('testKmhToMs');
    console.log('kmhToMs(3.6):', kmhToMs(3.6));
    expectClose(kmhToMs(3.6), 1);
    console.log('kmhToMs(36):', kmhToMs(36));
    expectClose(kmhToMs(36), 10);
    console.log('✓ Passed');
})();

(function testDirFromSpeedToUV() {
    console.log('testDirFromSpeedToUV');
    // Wind from North (0°) at 10 m/s should go south: u ≈ 0, v ≈ -10
    const { u, v } = dirFromDegSpeedMsToUV(0, 10);
    console.log('dirFromDegSpeedMsToUV(0, 10):', { u, v });
    expectClose(u, 0, 1e-12);
    expectClose(v, -10);
    // Wind from West (270°) should go east: u ≈ +10, v ≈ 0
    const a = dirFromDegSpeedMsToUV(270, 10);
    console.log('dirFromDegSpeedMsToUV(270, 10):', a);
    expectClose(a.u, 10);
    expectClose(a.v, 0, 1e-12);
    console.log('✓ Passed');
})();