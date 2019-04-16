/**
 * A path suitable for use as a key in a Map.
 *
 * Right now just serialized to string, but this is hidden from users of this
 * module with an opaque type.
 *
 * @flow strict
 */

import {type Path} from "./tree";

opaque type EncodedPath = string;
export type {EncodedPath};

export function startsWith(path: EncodedPath, prefix: Path) {
  return path.startsWith(encodePath(prefix));
}

export function encodePath(path: Path): EncodedPath {
  return (
    "/" +
    path
      .map(p => {
        if (p.type === "object") {
          return `o>${p.key}`;
        } else if (p.type === "array") {
          return `a>${p.index}`;
        } else {
          (p.type: empty); // eslint-disable-line no-unused-expressions
          throw new Error(`Bad path type ${p.type}`);
        }
      })
      .join("/")
  );
}

export function decodePath(s: EncodedPath): Path {
  return s
    .split("/")
    .filter(x => x !== "")
    .map(s => {
      const [type, val] = s.split(">");
      if (type === "o") {
        return {type: "object", key: val};
      } else if (type === "a") {
        return {type: "array", index: parseInt(val, 10)};
      } else {
        throw new Error(`Bad encoded path type '${type}' for path '${s}'`);
      }
    });
}
