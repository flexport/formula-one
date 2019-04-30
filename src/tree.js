// @flow strict
import {setEq} from "./utils/set";
import invariant from "./utils/invariant";

export type Tree<T> =
  | {
      type: "leaf",
      data: T,
    }
  | {
      type: "object",
      data: T,
      children: {[string]: Tree<T>},
    }
  | {
      type: "array",
      data: T,
      children: Array<Tree<T>>,
    };

export function leaf<T>(
  data: T
): {
  type: "leaf",
  data: T,
} {
  return {
    type: "leaf",
    data,
  };
}

export type Direction =
  | {type: "object", key: string}
  | {type: "array", index: number};
export type Path = Array<Direction>;

export function pathFromPathString(pathString: string): Path {
  if (pathString[0] !== "/") {
    throw new Error("Error paths must start with forward-slash");
  }

  if (pathString === "/") {
    return [];
  }

  return pathString
    .slice(1)
    .split("/")
    .map(keyPart => {
      // This might be dangerous, since it means you can't use numbers as object
      // keys. This is acceptable for now.
      if (!isNaN(keyPart)) {
        return {
          type: "array",
          index: Number.parseInt(keyPart, 10),
        };
      } else {
        return {
          type: "object",
          key: keyPart,
        };
      }
    });
}

export function strictZipWith<A, B, C>(
  f: (A, B) => C,
  left: Tree<A>,
  right: Tree<B>
): Tree<C> {
  if (left.type === "object" && right.type === "object") {
    if (!setEq(new Set(Object.keys(left)), new Set(Object.keys(right)))) {
      throw new Error("Tried to zip two object nodes with different keys");
    }

    return {
      type: "object",
      data: f(left.data, right.data),
      children: Object.keys(left.children).reduce((memo, k) => {
        invariant(
          left.type === "object" && right.type === "object",
          "This should never happen."
        );
        return {
          ...memo,
          [k]: strictZipWith(f, left.children[k], right.children[k]),
        };
      }, {}),
    };
  }

  if (left.type === "array" && right.type === "array") {
    if (left.children.length !== right.children.length) {
      throw new Error("Tried to zip two array nodes with different lengths");
    }

    return {
      type: "array",
      data: f(left.data, right.data),
      children: left.children.map((_, i) => {
        invariant(left.type === "array" && right.type === "array");
        return strictZipWith(f, left.children[i], right.children[i]);
      }),
    };
  }

  if (left.type === "leaf" && right.type === "leaf") {
    return {
      type: "leaf",
      data: f(left.data, right.data),
    };
  }

  throw new Error("Tried to zip two nodes of different type");
}

// A tree is a functor
export function mapTree<A, B>(f: A => B, tree: Tree<A>): Tree<B> {
  if (tree.type === "object") {
    return {
      type: "object",
      data: f(tree.data),
      children: Object.keys(tree.children).reduce(
        (memo, key) => ({...memo, [key]: mapTree(f, tree.children[key])}),
        {}
      ),
    };
  } else if (tree.type === "array") {
    return {
      type: "array",
      data: f(tree.data),
      children: tree.children.map(child => mapTree(f, child)),
    };
  } else {
    return {
      type: "leaf",
      data: f(tree.data),
    };
  }
}

// Fold a tree preorder
export function foldMapTree<T, Folded>(
  mapper: T => Folded,
  mempty: Folded,
  mappend: (Folded, Folded) => Folded,
  tree: Tree<T>
): Folded {
  if (tree.type === "leaf") {
    return mapper(tree.data);
  } else if (tree.type === "array") {
    const foldedChildren = tree.children.reduce(
      (memo: Folded, childTree) =>
        mappend(memo, foldMapTree(mapper, mempty, mappend, childTree)),
      mempty
    );
    return mappend(mapper(tree.data), foldedChildren);
  } else {
    const foldedChildren = Object.keys(tree.children).reduce(
      (memo: Folded, key) =>
        mappend(memo, foldMapTree(mapper, mempty, mappend, tree.children[key])),
      mempty
    );
    return mappend(mapper(tree.data), foldedChildren);
  }
}
