export function secureRandomInt(maxExclusive, randomSource = globalThis.crypto) {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > 0x100000000) {
    throw new RangeError('maxExclusive는 1 이상 2^32 이하여야 합니다.');
  }
  if (!randomSource || typeof randomSource.getRandomValues !== 'function') {
    throw new Error('보안 난수 기능을 사용할 수 없습니다.');
  }

  const range = 0x100000000;
  const limit = Math.floor(range / maxExclusive) * maxExclusive;
  const value = new Uint32Array(1);
  do {
    randomSource.getRandomValues(value);
  } while (value[0] >= limit);
  return value[0] % maxExclusive;
}

export function shuffleSecure(values, randomSource = globalThis.crypto) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = secureRandomInt(index + 1, randomSource);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function createSevenBag(randomSource = globalThis.crypto) {
  return shuffleSecure(['I', 'O', 'T', 'S', 'Z', 'J', 'L'], randomSource);
}
