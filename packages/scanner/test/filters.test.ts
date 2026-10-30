import { Lang, parse } from "@ast-grep/napi";
import { describe, expect, test } from "vitest";
import { FILTERS } from "../src/rules/filters.js";

const FIRST_AWAIT_DECL = {
  rule: {
    kind: "lexical_declaration",
    has: {
      kind: "variable_declarator",
      has: { field: "value", kind: "await_expression" },
    },
    precedes: { kind: "lexical_declaration" },
  },
};

function keep(source: string): boolean {
  const root = parse(Lang.TypeScript, source).root();
  const match = root.find(FIRST_AWAIT_DECL);
  if (!match) throw new Error("fixture produced no match");
  const filter = FILTERS.sequentialAwaitsIndependent;
  if (!filter) throw new Error("filter missing");
  return filter(match, root);
}

describe("sequentialAwaitsIndependent", () => {
  test("keeps independent awaits", () =>
    expect(keep("const a = await f(); const b = await g();")).toBe(true));
  test("drops when second uses first", () =>
    expect(keep("const a = await f(); const b = await g(a.id);")).toBe(false));
  test("drops when second uses a destructured name", () =>
    expect(keep("const { id } = await f(); const b = await g(id);")).toBe(
      false,
    ));
  test("drops when second uses a renamed destructured name", () =>
    expect(
      keep("const { id: userId } = await f(); const b = await g(userId);"),
    ).toBe(false));
  test("drops when second uses first via object shorthand", () =>
    expect(keep("const a = await f(); const b = await g({ a });")).toBe(false));
  test("keeps when a property name merely matches the first binding", () =>
    expect(keep("const a = await f(); const b = await g(obj.a);")).toBe(true));
});

function keepLookup(source: string): boolean {
  const root = parse(Lang.TypeScript, source).root();
  const match = root.find({ rule: { pattern: "$R.includes($$$A)" } });
  if (!match) throw new Error("fixture produced no match");
  const filter = FILTERS.receiverNotLoopBound;
  if (!filter) throw new Error("filter missing");
  return filter(match, root);
}

describe("receiverNotLoopBound", () => {
  test("keeps receiver declared outside the loop", () =>
    expect(keepLookup("for (const x of a) { b.includes(x); }")).toBe(true));
  test("drops for-of variable receiver", () =>
    expect(keepLookup("for (const f of files) { f.includes('x'); }")).toBe(
      false,
    ));
  test("drops for-of destructured receiver", () =>
    expect(keepLookup("for (const [k, v] of m) { v.includes(k); }")).toBe(
      false,
    ));
  test("drops for-init receiver", () =>
    expect(keepLookup("for (let l = mk(); n--; ) { l.includes(n); }")).toBe(
      false,
    ));
  test("drops callback param receiver", () =>
    expect(keepLookup("xs.map((l) => l.includes(':'));")).toBe(false));
  test("drops single unparenthesised param receiver", () =>
    expect(keepLookup("xs.map(l => l.includes(':'));")).toBe(false));
  test("drops destructured callback param receiver", () =>
    expect(keepLookup("xs.map(({ tags }) => tags.includes('a'));")).toBe(
      false,
    ));
  test("keeps outer collection used in callback", () =>
    expect(keepLookup("xs.map((x) => ys.includes(x));")).toBe(true));
  test("keeps param of a non-iteration function", () =>
    expect(
      keepLookup("function f(a) { for (const x of xs) { a.includes(x); } }"),
    ).toBe(true));
  test("keeps receiver referenced only in a for initializer value", () =>
    expect(
      keepLookup(
        "for (let i = 0, n = list.length; i < n; i++) { list.includes(i); }",
      ),
    ).toBe(true));
  test("keeps receiver used only as a destructuring default in callback params", () =>
    expect(keepLookup("xs.map(({ a = dflt }) => dflt.includes(a));")).toBe(
      true,
    ));
  test("keeps receiver used only as a for-of destructuring default", () =>
    expect(
      keepLookup("for (const { a = dflt } of xs) { dflt.includes(a); }"),
    ).toBe(true));
  test("drops receiver bound by a defaulted destructured param", () =>
    expect(keepLookup("xs.map(({ a = d }) => a.includes('x'));")).toBe(false));
});

function keepUseClient(source: string): boolean {
  const root = parse(Lang.Tsx, source).root();
  const match = root.find({ rule: { kind: "expression_statement" } });
  if (!match) throw new Error("fixture produced no match");
  const filter = FILTERS.noClientOnlyFeatures;
  if (!filter) throw new Error("filter missing");
  return filter(match, root);
}

const DIRECTIVE = '"use client";\n';

describe("noClientOnlyFeatures", () => {
  test("keeps a file with no client-only features", () =>
    expect(
      keepUseClient(`${DIRECTIVE}export const A = () => <div>{fmt(1)}</div>;`),
    ).toBe(true));
  test("drops a file calling a use* hook", () =>
    expect(
      keepUseClient(
        `${DIRECTIVE}export const A = () => { useRouter(); return <i />; };`,
      ),
    ).toBe(false));
  test("drops a file calling a namespaced hook", () =>
    expect(
      keepUseClient(
        `${DIRECTIVE}export const A = () => { React.useId(); return <i />; };`,
      ),
    ).toBe(false));
  test("keeps a call to a lowercase-after-use function", () =>
    expect(
      keepUseClient(
        `${DIRECTIVE}export const A = () => { user(); return <i />; };`,
      ),
    ).toBe(true));
  test("drops a file with an on* JSX attribute", () =>
    expect(
      keepUseClient(`${DIRECTIVE}export const A = () => <b onClick={go} />;`),
    ).toBe(false));
  test("keeps a file with a non-handler attribute starting with on", () =>
    expect(
      keepUseClient(`${DIRECTIVE}export const A = () => <b once="x" />;`),
    ).toBe(true));
  test("drops a file using window", () =>
    expect(
      keepUseClient(`${DIRECTIVE}export const w = () => window.innerWidth;`),
    ).toBe(false));
  test("drops a file using localStorage", () =>
    expect(
      keepUseClient(
        `${DIRECTIVE}export const w = () => localStorage.getItem("a");`,
      ),
    ).toBe(false));
  test("keeps a file where a browser global is only a property name", () =>
    expect(
      keepUseClient(`${DIRECTIVE}export const w = (o: O) => o.window;`),
    ).toBe(true));
  test("drops a class component extending Component", () =>
    expect(
      keepUseClient(
        `${DIRECTIVE}class A extends Component { render() { return <i />; } }`,
      ),
    ).toBe(false));
  test("drops a class component extending React.PureComponent", () =>
    expect(
      keepUseClient(
        `${DIRECTIVE}class A extends React.PureComponent { render() { return <i />; } }`,
      ),
    ).toBe(false));
  test("keeps a class extending something else", () =>
    expect(
      keepUseClient(
        `${DIRECTIVE}class A extends Base { render() { return <i />; } }`,
      ),
    ).toBe(true));
  test("drops a file creating a context", () =>
    expect(
      keepUseClient(`${DIRECTIVE}export const C = createContext(null);`),
    ).toBe(false));
  test("drops a file with export-from", () =>
    expect(keepUseClient(`${DIRECTIVE}export { Toaster } from "sonner";`)).toBe(
      false,
    ));
  test("drops a file rendering a third-party JSX tag", () =>
    expect(
      keepUseClient(`${DIRECTIVE}import { P } from "next-themes";
export const A = () => <P />;`),
    ).toBe(false));
  test("drops a file rendering a member tag of a third-party namespace", () =>
    expect(
      keepUseClient(
        `${DIRECTIVE}import * as D from "@radix-ui/react-dialog";
export const A = () => <D.Overlay />;`,
      ),
    ).toBe(false));
  test("drops a file aliasing a third-party binding", () =>
    expect(
      keepUseClient(`${DIRECTIVE}import { motion } from "framer-motion";
export const M = motion.div;`),
    ).toBe(false));
  test("keeps a file rendering only local-import tags", () =>
    expect(
      keepUseClient(
        `${DIRECTIVE}import { Card } from "@/ui/card";
import { Row } from "./row";
export const A = () => <Card><Row /></Card>;`,
      ),
    ).toBe(true));
  test("keeps a file rendering react and next tags", () =>
    expect(
      keepUseClient(
        `${DIRECTIVE}import { Fragment } from "react";
import Link from "next/link";
export const A = () => <Fragment><Link href="/" /></Fragment>;`,
      ),
    ).toBe(true));
  test("keeps a file importing a third-party binding it never renders or aliases", () =>
    expect(
      keepUseClient(`${DIRECTIVE}import { fmt } from "date-fns";
export const A = () => <i>{fmt(1)}</i>;`),
    ).toBe(true));
});

function keepEffect(source: string): boolean {
  const root = parse(Lang.Tsx, source).root();
  const match = root.find({ rule: { pattern: "useEffect($$$A)" } });
  if (!match) throw new Error("fixture produced no match");
  const filter = FILTERS.onlyDerivedSetState;
  if (!filter) throw new Error("filter missing");
  return filter(match, root);
}

describe("onlyDerivedSetState", () => {
  test("keeps a single setter call", () =>
    expect(keepEffect("useEffect(() => { setA(p.a * 2); }, [p.a]);")).toBe(
      true,
    ));
  test("keeps several setter calls", () =>
    expect(keepEffect("useEffect(() => { setA(p.a); setB(p.b); }, [p]);")).toBe(
      true,
    ));
  test("keeps an expression-bodied setter call", () =>
    expect(keepEffect("useEffect(() => setA(p.a), [p.a]);")).toBe(true));
  test("keeps a function expression callback", () =>
    expect(keepEffect("useEffect(function () { setA(p.a); }, [p.a]);")).toBe(
      true,
    ));
  test("drops a literal boolean setter", () =>
    expect(keepEffect("useEffect(() => { setMounted(true); }, []);")).toBe(
      false,
    ));
  test("drops a literal number setter", () =>
    expect(keepEffect("useEffect(() => { setPage(1); }, [q]);")).toBe(false));
  test("drops a literal string, null, empty array and empty object setters", () =>
    expect(
      keepEffect(
        "useEffect(() => { setA('x'); setB(null); setC([]); setD({}); setE(`t`); setF(undefined); setG(-1); }, [q]);",
      ),
    ).toBe(false));
  test("keeps when one setter has a non-literal argument", () =>
    expect(
      keepEffect("useEffect(() => { setOpen(false); setB(p.b); }, [p]);"),
    ).toBe(true));
  test("keeps a template literal with substitution", () =>
    expect(keepEffect("useEffect(() => { setA(`x${p}`); }, [p]);")).toBe(true));
  test("keeps a non-empty array literal", () =>
    expect(keepEffect("useEffect(() => { setA([p]); }, [p]);")).toBe(true));
  test("drops an empty body", () =>
    expect(keepEffect("useEffect(() => {}, []);")).toBe(false));
  test("drops a non-setter statement", () =>
    expect(keepEffect("useEffect(() => { track(p); setA(1); }, [p]);")).toBe(
      false,
    ));
  test("drops a lowercase set-prefixed call", () =>
    expect(keepEffect("useEffect(() => { settle(p); }, [p]);")).toBe(false));
  test("drops a member setter call", () =>
    expect(keepEffect("useEffect(() => { store.setA(p); }, [p]);")).toBe(
      false,
    ));
  test("drops a returned cleanup", () =>
    expect(
      keepEffect("useEffect(() => { setA(1); return () => setA(0); }, []);"),
    ).toBe(false));
  test("drops an async callback", () =>
    expect(keepEffect("useEffect(async () => { setA(1); }, []);")).toBe(false));
  test("drops an await inside a setter argument", () =>
    expect(keepEffect("useEffect(() => { setA(await load()); }, []);")).toBe(
      false,
    ));
  test("drops fetch inside a setter argument", () =>
    expect(keepEffect("useEffect(() => { setA(fetch(u)); }, []);")).toBe(
      false,
    ));
  test("drops addEventListener in a setter argument", () =>
    expect(
      keepEffect("useEffect(() => { setA(w.addEventListener('x', f)); }, []);"),
    ).toBe(false));
  test("drops setTimeout in a setter argument", () =>
    expect(
      keepEffect("useEffect(() => { setA(setTimeout(f, 1)); }, []);"),
    ).toBe(false));
  test("drops setInterval in a setter argument", () =>
    expect(
      keepEffect("useEffect(() => { setA(setInterval(f, 1)); }, []);"),
    ).toBe(false));
  test("drops a non-function first argument", () =>
    expect(keepEffect("useEffect(effect, []);")).toBe(false));
});

describe("sequentialAwaitsIndependent skips ordered first steps", () => {
  test("drops a guard before the next await", () => {
    expect(keep("const u = await requireUser(); const b = await g();")).toBe(false);
    expect(keep("const s = await auth(); const b = await g();")).toBe(false);
  });
  test("drops dynamic imports", () => {
    expect(keep('const a = await import("x"); const b = await g();')).toBe(false);
    expect(keep('const a = await f(); const b = await import("y");')).toBe(false);
  });
  test("drops route params and request helpers", () => {
    expect(keep("const { id } = await params; const b = await g();")).toBe(false);
    expect(keep("const c = await cookies(); const b = await g();")).toBe(false);
  });
  test("keeps ordinary independent calls", () => {
    expect(keep("const a = await listBooks(); const b = await countUsers();")).toBe(true);
  });
});

describe("noClientOnlyFeatures on non-JSX grammars", () => {
  test("does not throw on a .ts file", () => {
    const root = parse(Lang.TypeScript, '"use client";\nexport const a = 1;\n').root();
    const filter = FILTERS.noClientOnlyFeatures;
    if (!filter) throw new Error("filter missing");
    expect(filter(root, root)).toBe(true);
  });
});
