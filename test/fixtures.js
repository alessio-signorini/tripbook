import { readFileSync } from 'node:fs';

/** Fresh copies of the example trips in examples/data (safe to mutate). */
export const load = (p) => JSON.parse(readFileSync(new URL(`../examples/data/${p}`, import.meta.url), 'utf8'));
export const pisa = () => load('published/pisa-in-one-walk.json');
export const sb = () => load('published/santa-barbara-perfect-day.json');
export const layover = () => load('drafts/pisa-4-hours-layover.json');
