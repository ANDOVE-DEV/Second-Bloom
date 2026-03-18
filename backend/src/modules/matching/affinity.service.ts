import { Injectable } from '@nestjs/common';
import { Profile } from '../users/entities/profile.entity';

@Injectable()
export class AffinityService {
  calculateScore(current: Profile, candidate: Profile): number {
    const o = this.intentScore(current.intent, candidate.intent);
    const v = this.valuesScore(current, candidate);
    const i = this.interestsScore(current.interests, candidate.interests);
    const d = this.distancePenalty(current, candidate);

    return 0.4 * o + 0.3 * v + 0.2 * i - d;
  }

  private intentScore(
    a: Profile['intent'] | null,
    b: Profile['intent'] | null,
  ): number {
    if (!a || !b) {
      return 0.5;
    }

    if (a === b) {
      return 1;
    }

    const compatiblePairs = new Set([
      'relazione_stabile:convivenza',
      'convivenza:relazione_stabile',
      'amicizia:vediamo',
      'vediamo:amicizia',
    ]);

    return compatiblePairs.has(`${a}:${b}`) ? 0.5 : 0;
  }

  private valuesScore(current: Profile, candidate: Profile): number {
    const smokes = this.binaryMatch(current.smokes, candidate.smokes, 0.5);
    const kids = this.binaryMatch(
      current.hasCohabitingKids,
      candidate.hasCohabitingKids,
      0.5,
    );
    const politics = this.enumMatch(
      current.politicalLean,
      candidate.politicalLean,
      0.5,
    );
    const religion = this.enumMatch(current.religion, candidate.religion, 0.5);

    return smokes * 0.3 + kids * 0.25 + politics * 0.2 + religion * 0.25;
  }

  private interestsScore(a: string[], b: string[]): number {
    const setA = new Set((a ?? []).map((v) => v.toLowerCase().trim()));
    const setB = new Set((b ?? []).map((v) => v.toLowerCase().trim()));

    if (setA.size === 0 && setB.size === 0) {
      return 0.5;
    }

    let intersection = 0;
    for (const value of setA) {
      if (setB.has(value)) {
        intersection += 1;
      }
    }

    const union = new Set([...setA, ...setB]).size;
    return union === 0 ? 0 : intersection / union;
  }

  private distancePenalty(current: Profile, candidate: Profile): number {
    const lat1 = this.toNullableNumber(current.latitude);
    const lon1 = this.toNullableNumber(current.longitude);
    const lat2 = this.toNullableNumber(candidate.latitude);
    const lon2 = this.toNullableNumber(candidate.longitude);

    if (lat1 === null || lon1 === null || lat2 === null || lon2 === null) {
      return Math.log10(31);
    }

    const d = this.haversineKm(lat1, lon1, lat2, lon2);
    return Math.log10(d + 1);
  }

  private binaryMatch(
    a: boolean | null,
    b: boolean | null,
    fallback: number,
  ): number {
    if (a === null || b === null) {
      return fallback;
    }

    return a === b ? 1 : 0;
  }

  private enumMatch(
    a: string | null,
    b: string | null,
    fallback: number,
  ): number {
    if (!a || !b || a === 'prefer_not' || b === 'prefer_not') {
      return fallback;
    }

    return a === b ? 1 : 0;
  }

  private toNullableNumber(value: string | null): number | null {
    if (value === null) {
      return null;
    }

    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  private haversineKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const r = 6371;
    const toRad = (value: number) => (value * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return r * c;
  }
}
