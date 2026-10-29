import {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
export type ArtProduct = {
  id: string;
  name: string;
  image: string;
  combo?: string;
};

export type Measurable = {
  measureInWindow: (
    callback: (x: number, y: number, width: number, height: number) => void,
  ) => void;
};
type Rect = { x: number; y: number; width: number; height: number };
type Art = { node: Measurable; detail: boolean; featured: boolean };
type Frame = Pick<Art, "detail" | "featured"> & { rect: Rect };
export type ProductTransition = {
  id: number;
  product: ArtProduct;
  source: string;
  target: string;
  origin: Rect;
  from: Frame;
  to: Frame | null;
};

function measure(node: Measurable): Promise<Rect | null> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), 120);
    node.measureInWindow((x, y, width, height) => {
      clearTimeout(timeout);
      resolve(width > 0 && height > 0 ? { x, y, width, height } : null);
    });
  });
}
function relative(rect: Rect, origin: Rect): Rect {
  return { ...rect, x: rect.x - origin.x, y: rect.y - origin.y };
}

export function useProductMotion(
  screen: string,
  viewport: RefObject<Measurable | null>,
  reduced: boolean,
) {
  const registry = useRef(new Map<string, Art>());
  const generation = useRef(0);
  const [transition, setTransition] = useState<ProductTransition | null>(null);
  const register = useCallback((key: string, art: Art | null) => {
    if (art) registry.current.set(key, art);
    else registry.current.delete(key);
  }, []);
  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );
  useEffect(() => {
    if (!transition) return;
    // A missing destination must never leave retained scenes or hidden artwork behind.
    const timeout = setTimeout(
      () =>
        setTransition((current) =>
          current?.id === transition.id ? null : current,
        ),
      900,
    );
    return () => clearTimeout(timeout);
  }, [transition]);
  const navigate = useCallback(
    (next: string, product: ArtProduct, commit: () => void) => {
      const id = ++generation.current;
      setTransition(null);
      const shared =
        (screen === "catalog" && next === "product") ||
        (screen === "product" && next === "catalog");
      const art = registry.current.get(`${screen}:${product.id}`);
      const root = viewport.current;
      if (!shared || reduced || !art || !root) {
        commit();
        return;
      }
      void Promise.all([measure(art.node), measure(root)]).then(
        ([rect, origin]) => {
          if (generation.current !== id) return;
          if (rect && origin)
            setTransition({
              id,
              product,
              source: screen,
              target: next,
              origin,
              from: {
                rect: relative(rect, origin),
                detail: art.detail,
                featured: art.featured,
              },
              to: null,
            });
          commit();
        },
      );
    },
    [screen, viewport, reduced],
  );
  const reportTarget = useCallback(
    (key: string, node: Measurable, id: number) => {
      if (
        !transition ||
        transition.id !== id ||
        transition.to ||
        key !== `${transition.target}:${transition.product.id}`
      )
        return;
      const art = registry.current.get(key);
      if (!art) return;
      void measure(node).then((rect) => {
        if (!rect || generation.current !== id) return;
        setTransition((current) =>
          current?.id === id
            ? {
                ...current,
                to: {
                  rect: relative(rect, current.origin),
                  detail: art.detail,
                  featured: art.featured,
                },
              }
            : current,
        );
      });
    },
    [transition],
  );
  const complete = useCallback((id: number) => {
    setTransition((current) => (current?.id === id ? null : current));
  }, []);
  return { transition, navigate, register, reportTarget, complete };
}

export const ProductMotionContext = createContext<ReturnType<
  typeof useProductMotion
> | null>(null);
