// @flow strict

export function removeAt<E>(index: number, arr: $ReadOnlyArray<E>): Array<E> {
  return [...arr.slice(0, index), ...arr.slice(index + 1)];
}

export function replaceAt<E>(
  index: number,
  item: E,
  arr: $ReadOnlyArray<E>
): Array<E> {
  return [...arr.slice(0, index), item, ...arr.slice(index + 1)];
}

export function insertAt<E>(
  index: number,
  item: E,
  arr: $ReadOnlyArray<E>
): Array<E> {
  return [...arr.slice(0, index), item, ...arr.slice(index)];
}

export function moveFromTo<E>(
  oldIndex: number,
  newIndex: number,
  arr: $ReadOnlyArray<E>
): Array<E> {
  const without = removeAt(oldIndex, arr);
  return insertAt(newIndex, arr[oldIndex], without);
}

type AddSpan<E> = [number, $ReadOnlyArray<E>];

export function modify<E>(
  {
    insertSpans,
    filterPredicate,
  }: {
    insertSpans?: $ReadOnlyArray<AddSpan<E>>,
    filterPredicate?: (E, number, $ReadOnlyArray<E>) => boolean,
  },
  arr: $ReadOnlyArray<E>
): Array<E> {
  let sortedSpans = [];
  if (insertSpans !== undefined) {
    // no duplicated indices are allowed, ECMAScript Array.sort is not stable by spec
    const indexSet = new Set(insertSpans.map(([i]) => i));
    if (indexSet.size !== insertSpans.length) {
      throw new Error(
        "You cannot insert two spans at the same index. Combine the values of the spans."
      );
    }

    // sort spans by insertion position
    sortedSpans = [...insertSpans];
    sortedSpans.sort(([i], [j]) => i - j);
  }

  // The next span to insert
  let nextSpanIndex = 0;

  // build the new array in one pass
  let ret = [];
  for (let i = 0; i < arr.length; i += 1) {
    if (nextSpanIndex < sortedSpans.length) {
      const [index, contents] = sortedSpans[nextSpanIndex];
      if (index === i) {
        ret = ret.concat(contents);
        nextSpanIndex += 1;
      }
    }
    if (filterPredicate === undefined || filterPredicate(arr[i], i, arr)) {
      ret.push(arr[i]);
    }
  }

  // insert spans after the end of the array
  for (let i = nextSpanIndex; i < sortedSpans.length; i += 1) {
    const [_, contents] = sortedSpans[i];
    ret = ret.concat(contents);
  }

  return ret;
}

export function insertSpans<E>(
  spans: $ReadOnlyArray<AddSpan<E>>,
  arr: $ReadOnlyArray<E>
): Array<E> {
  return modify({insertSpans: spans}, arr);
}

// Strict on length
export function zipWith<A, B, C>(
  f: (A, B) => C,
  left: $ReadOnlyArray<A>,
  right: $ReadOnlyArray<B>
): Array<C> {
  if (left.length !== right.length) {
    throw new Error("Tried to zip two lists of unequal length");
  }
  const ret = [];
  for (let i = 0; i < left.length; i += 1) {
    ret.push(f(left[i], right[i]));
  }
  return ret;
}

export function zip<A, B>(
  left: $ReadOnlyArray<A>,
  right: $ReadOnlyArray<B>
): Array<[A, B]> {
  return zipWith((l, r) => [l, r], left, right);
}

export function unzip<A, B>(
  zipped: $ReadOnlyArray<[A, B]>
): [Array<A>, Array<B>] {
  const ret = [[], []];
  for (let i = 0; i < zipped.length; i += 1) {
    const [left, right] = zipped[i];
    ret[0].push(left);
    ret[1].push(right);
  }
  return ret;
}

export function equals<E>(a: $ReadOnlyArray<E>, b: $ReadOnlyArray<E>): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}
