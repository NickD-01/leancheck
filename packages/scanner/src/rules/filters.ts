import type { SgNode } from "@ast-grep/napi";

export type FilterFn = (match: SgNode, root: SgNode) => boolean;

const PATTERN_NAME_KINDS = [
  "identifier",
  "shorthand_property_identifier_pattern",
];
const REFERENCE_KINDS = ["identifier", "shorthand_property_identifier"];

function namesIn(node: SgNode | null, kinds: string[]): Set<string> {
  const names = new Set<string>();
  if (!node) return names;
  const nodes = kinds.includes(String(node.kind())) ? [node] : [];
  for (const n of [
    ...nodes,
    ...node.findAll({ rule: { any: kinds.map((kind) => ({ kind })) } }),
  ]) {
    names.add(n.text());
  }
  return names;
}

const DEFAULTED_PATTERN_KINDS = [
  "assignment_pattern",
  "object_assignment_pattern",
];

// Collects names a pattern binds; default-value subtrees only reference names, so they are skipped.
function patternNames(
  node: SgNode | null,
  names: Set<string> = new Set(),
): Set<string> {
  if (!node) return names;
  const kind = String(node.kind());
  if (PATTERN_NAME_KINDS.includes(kind)) names.add(node.text());
  else if (DEFAULTED_PATTERN_KINDS.includes(kind))
    patternNames(node.field("left"), names);
  else for (const child of node.children()) patternNames(child, names);
  return names;
}

function declaratorNames(declaration: SgNode | null): Set<string> {
  const names = new Set<string>();
  for (const d of declaration?.children() ?? []) {
    if (String(d.kind()) === "variable_declarator")
      patternNames(d.field("name"), names);
  }
  return names;
}

function bindingNames(declaration: SgNode): Set<string> {
  return declaratorNames(declaration);
}

function initializerReferences(declaration: SgNode): Set<string> {
  const names = new Set<string>();
  for (const declarator of declaration
    .children()
    .filter((c) => String(c.kind()) === "variable_declarator")) {
    for (const n of namesIn(declarator.field("value"), REFERENCE_KINDS))
      names.add(n);
  }
  return names;
}

// The rule matches the first of two adjacent await declarations; the second is its next sibling.
const sequentialAwaitsIndependent: FilterFn = (match) => {
  const second = match.next();
  if (!second) return false;
  const bound = bindingNames(match);
  return ![...initializerReferences(second)].some((name) => bound.has(name));
};

const LOOP_KINDS = ["for_statement", "for_in_statement", "while_statement"];
const FUNCTION_KINDS = ["arrow_function", "function_expression"];
const ITERATION_METHODS = new Set(["map", "forEach", "reduce", "filter"]);

function isIterationCallback(fn: SgNode): boolean {
  const args = fn.parent();
  const call = args?.parent();
  if (!args || !call || String(args.kind()) !== "arguments") return false;
  if (String(call.kind()) !== "call_expression") return false;
  const property = call.field("function")?.field("property");
  return (
    property !== undefined &&
    property !== null &&
    ITERATION_METHODS.has(property.text())
  );
}

function loopBoundNames(node: SgNode): Set<string> {
  const kind = String(node.kind());
  const names = new Set<string>();
  const sources: (SgNode | null)[] = [];
  if (kind === "for_in_statement") sources.push(node.field("left"));
  if (kind === "for_statement") {
    for (const n of declaratorNames(node.field("initializer"))) names.add(n);
  }
  if (FUNCTION_KINDS.includes(kind) && isIterationCallback(node)) {
    sources.push(node.field("parameters"), node.field("parameter"));
  }
  for (const source of sources) {
    for (const n of patternNames(source)) names.add(n);
  }
  return names;
}

// A lookup on the loop item (or a callback parameter) is per-item work, not a quadratic scan.
const receiverNotLoopBound: FilterFn = (match) => {
  const receiver = match.field("function")?.field("object");
  if (!receiver) return true;
  const name = receiver.text();
  for (let n = match.parent(); n; n = n.parent()) {
    if (loopBoundNames(n).has(name)) return false;
  }
  return true;
};

const BATCH_NAME = /chunk|batch/i;
const WRITE_METHODS = new Set(["insert", "values"]);

function isSame(a: SgNode, b: SgNode): boolean {
  const ra = a.range();
  const rb = b.range();
  return ra.start.index === rb.start.index && ra.end.index === rb.end.index;
}

// Climbs `a.b().c()` to the outermost call of the chain the node belongs to.
function chainRoot(node: SgNode): SgNode {
  let current = node;
  for (;;) {
    const member = current.parent();
    const call = member?.parent();
    const object = member?.field("object");
    if (
      !member ||
      !call ||
      !object ||
      String(member.kind()) !== "member_expression" ||
      String(call.kind()) !== "call_expression" ||
      !isSame(object, current)
    ) {
      return current;
    }
    current = call;
  }
}

function chainCalls(root: SgNode): SgNode[] {
  return [root, ...root.findAll({ rule: { kind: "call_expression" } })];
}

function calleeName(call: SgNode): string {
  return call.field("function")?.field("property")?.text() ?? "";
}

function insertedValuesAreBatched(match: SgNode): boolean {
  return chainCalls(chainRoot(match)).some(
    (call) =>
      calleeName(call) === "values" &&
      BATCH_NAME.test(call.field("arguments")?.text() ?? ""),
  );
}

function loopHeaderText(node: SgNode): string {
  const kind = String(node.kind());
  if (LOOP_KINDS.includes(kind)) {
    return ["left", "right", "initializer", "condition", "increment"]
      .map((f) => node.field(f)?.text() ?? "")
      .join(" ");
  }
  if (FUNCTION_KINDS.includes(kind) && isIterationCallback(node)) {
    const call = node.parent()?.parent();
    const receiver = call?.field("function")?.field("object")?.text() ?? "";
    const params =
      node.field("parameters")?.text() ?? node.field("parameter")?.text() ?? "";
    return `${receiver} ${params}`;
  }
  return "";
}

function isTransactionCallback(node: SgNode): boolean {
  if (
    !FUNCTION_KINDS.includes(String(node.kind())) ||
    !isIterationCallback(node)
  )
    return false;
  const outer = node.parent()?.parent()?.parent();
  const outerCall = outer?.parent();
  return (
    !!outer &&
    !!outerCall &&
    String(outer.kind()) === "arguments" &&
    calleeName(outerCall) === "$transaction"
  );
}

function inBatchedContext(match: SgNode): boolean {
  for (let n = match.parent(); n; n = n.parent()) {
    if (BATCH_NAME.test(loopHeaderText(n)) || isTransactionCallback(n))
      return true;
  }
  return false;
}

// Chunked or transaction-wrapped writes are the idiomatic fix, not the problem.
const prismaNotBatched: FilterFn = (match) => !inBatchedContext(match);

const drizzleInsertNotBatched: FilterFn = (match) => {
  if (!WRITE_METHODS.has(calleeName(match))) return true;
  return !insertedValuesAreBatched(match) && !inBatchedContext(match);
};

// Single-row intent, subqueries and dynamic builders are not unbounded reads.
const selectChainUnbounded: FilterFn = (match) => {
  if (calleeName(match) !== "from") return true;
  const root = chainRoot(match);
  if (chainCalls(root).some((call) => calleeName(call) === "$dynamic"))
    return false;
  const parent = root.parent();
  if (parent && String(parent.kind()) === "arguments") return false;
  const holder =
    parent && String(parent.kind()) === "await_expression"
      ? parent.parent()
      : parent;
  const name =
    holder && String(holder.kind()) === "variable_declarator"
      ? holder.field("name")
      : null;
  return !(name && String(name.kind()) === "array_pattern");
};

const HOOK_NAME = /^use[A-Z]/;
const BROWSER_GLOBALS =
  /^(window|document|localStorage|sessionStorage|navigator)$/;
const CLASS_BASE = /^(Component|PureComponent)$/;

const CLIENT_ONLY_FEATURES: Record<string, unknown>[] = [
  {
    kind: "call_expression",
    has: {
      field: "function",
      any: [
        { kind: "identifier", regex: HOOK_NAME.source },
        { kind: "identifier", regex: "^createContext$" },
        {
          kind: "member_expression",
          has: {
            field: "property",
            regex: `${HOOK_NAME.source}|^createContext$`,
          },
        },
      ],
    },
  },
  {
    kind: "jsx_attribute",
    has: { kind: "property_identifier", regex: "^on[A-Z]" },
  },
  { kind: "identifier", regex: BROWSER_GLOBALS.source },
  {
    kind: "class_heritage",
    has: {
      stopBy: "end",
      any: [
        { kind: "identifier", regex: CLASS_BASE.source },
        { kind: "property_identifier", regex: CLASS_BASE.source },
      ],
    },
  },
];

// A "use client" file with no hooks, handlers, browser globals, contexts or class components
// can run on the server, so the directive only ships extra JavaScript.
const noClientOnlyFeatures: FilterFn = (_match, root) =>
  !root.find({ rule: { any: CLIENT_ONLY_FEATURES } }) &&
  !isClientBoundaryWrapper(root);

const FRAMEWORK_SPECIFIER = /^(react|react-dom|next)(\/|$)/;
const LOCAL_SPECIFIER = /^(\.|\/|@\/|~\/|#)/;

function importSource(statement: SgNode): string {
  const source = statement.field("source")?.text() ?? "";
  return source.slice(1, -1);
}

function clauseBindings(statement: SgNode): string[] {
  const names: string[] = [];
  for (const clause of statement
    .children()
    .filter((c) => String(c.kind()) === "import_clause")) {
    for (const part of clause.children()) {
      const kind = String(part.kind());
      if (kind === "identifier") names.push(part.text());
      if (kind === "namespace_import") {
        names.push(
          ...part
            .children()
            .filter((c) => String(c.kind()) === "identifier")
            .map((c) => c.text()),
        );
      }
      if (kind === "named_imports") {
        for (const spec of part
          .children()
          .filter((c) => String(c.kind()) === "import_specifier")) {
          const local = spec.field("alias") ?? spec.field("name");
          if (local) names.push(local.text());
        }
      }
    }
  }
  return names;
}

function thirdPartyBindings(root: SgNode): Set<string> {
  const names = new Set<string>();
  for (const statement of root.findAll({
    rule: { kind: "import_statement" },
  })) {
    const source = importSource(statement);
    if (statement.text().startsWith("import type")) continue;
    if (FRAMEWORK_SPECIFIER.test(source) || LOCAL_SPECIFIER.test(source))
      continue;
    for (const name of clauseBindings(statement)) names.add(name);
  }
  return names;
}

function rootIdentifier(node: SgNode | null): string | undefined {
  if (!node) return undefined;
  const kind = String(node.kind());
  if (
    kind !== "identifier" &&
    kind !== "member_expression" &&
    kind !== "nested_identifier"
  ) {
    return undefined;
  }
  return node.text().split(".")[0];
}

function rendersImportedTag(root: SgNode, bound: Set<string>): boolean {
  return root
    .findAll({
      rule: {
        any: [
          { kind: "jsx_opening_element" },
          { kind: "jsx_self_closing_element" },
        ],
      },
    })
    .some((tag) => {
      const name = rootIdentifier(tag.field("name"));
      return name !== undefined && bound.has(name);
    });
}

function aliasesImportedBinding(root: SgNode, bound: Set<string>): boolean {
  return root
    .findAll({
      rule: {
        kind: "variable_declarator",
        inside: {
          kind: "lexical_declaration",
          inside: { kind: "export_statement" },
        },
      },
    })
    .some((d) => {
      const name = rootIdentifier(d.field("value"));
      return name !== undefined && bound.has(name);
    });
}

// Files that re-export or alias third-party client components exist to mark the client boundary.
function isClientBoundaryWrapper(root: SgNode): boolean {
  if (
    root.find({
      rule: {
        kind: "export_statement",
        has: { field: "source", kind: "string" },
      },
    })
  ) {
    return true;
  }
  const bound = thirdPartyBindings(root);
  if (bound.size === 0) return false;
  return rendersImportedTag(root, bound) || aliasesImportedBinding(root, bound);
}

const SETTER_NAME = /^set[A-Z]/;
const EFFECT_SIDE_EFFECTS = new Set([
  "fetch",
  "addEventListener",
  "setTimeout",
  "setInterval",
]);

function effectCallback(effect: SgNode): SgNode | null {
  const first = effect
    .field("arguments")
    ?.children()
    .find((c) => c.isNamed() && String(c.kind()) !== "comment");
  if (!first) return null;
  return FUNCTION_KINDS.includes(String(first.kind())) ? first : null;
}

function isSetterCall(node: SgNode): boolean {
  if (String(node.kind()) !== "call_expression") return false;
  const fn = node.field("function");
  return (
    !!fn && String(fn.kind()) === "identifier" && SETTER_NAME.test(fn.text())
  );
}

function isSetterStatement(stmt: SgNode): boolean {
  if (String(stmt.kind()) !== "expression_statement") return false;
  const expr = stmt.children().find((c) => c.isNamed());
  return !!expr && isSetterCall(expr);
}

function effectStatements(callback: SgNode): SgNode[] | null {
  const body = callback.field("body");
  if (!body) return null;
  if (String(body.kind()) !== "statement_block") return [body];
  return body
    .children()
    .filter((c) => c.isNamed() && String(c.kind()) !== "comment");
}

function hasEffectSideEffects(callback: SgNode): boolean {
  return (
    callback.find({
      rule: {
        any: [
          { kind: "await_expression" },
          { kind: "return_statement" },
          {
            kind: "identifier",
            regex: `^(${[...EFFECT_SIDE_EFFECTS].join("|")})$`,
          },
          {
            kind: "property_identifier",
            regex: `^(${[...EFFECT_SIDE_EFFECTS].join("|")})$`,
          },
        ],
      },
    }) !== null
  );
}

const LITERAL_KINDS = new Set([
  "true",
  "false",
  "number",
  "string",
  "null",
  "undefined",
]);

function isLiteral(node: SgNode): boolean {
  const kind = String(node.kind());
  if (LITERAL_KINDS.has(kind)) return true;
  if (kind === "identifier") return node.text() === "undefined";
  if (kind === "template_string")
    return node.find({ rule: { kind: "template_substitution" } }) === null;
  if (kind === "array" || kind === "object")
    return node.children().every((c) => !c.isNamed());
  if (kind === "unary_expression")
    return node.field("argument")?.kind() === "number";
  return false;
}

// setMounted(true) / setOpen(false) / setPage(1) are reset idioms, not derived state.
function setterArgsAreLiterals(statement: SgNode): boolean {
  const call =
    String(statement.kind()) === "call_expression"
      ? statement
      : statement.children().find((c) => c.isNamed());
  const args =
    call
      ?.field("arguments")
      ?.children()
      .filter((c) => c.isNamed()) ?? [];
  return args.every(isLiteral);
}

// An effect whose only job is to call setters mirrors render-time data into state.
const onlyDerivedSetState: FilterFn = (match) => {
  const callback = effectCallback(match);
  if (!callback || callback.text().startsWith("async")) return false;
  const statements = effectStatements(callback);
  if (!statements || statements.length === 0) return false;
  const allSetters = statements.every(
    (s) => isSetterStatement(s) || isSetterCall(s),
  );
  if (!allSetters || hasEffectSideEffects(callback)) return false;
  return !statements.every(setterArgsAreLiterals);
};

export const FILTERS: Record<string, FilterFn> = {
  sequentialAwaitsIndependent,
  receiverNotLoopBound,
  prismaNotBatched,
  drizzleInsertNotBatched,
  selectChainUnbounded,
  noClientOnlyFeatures,
  onlyDerivedSetState,
};
