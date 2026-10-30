import { main } from "./main.js";

// `leancheck scan | head` closes stdout early; that is not a failure.
process.stdout.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EPIPE") process.exit(0);
  throw err;
});

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (err: unknown) => {
    process.stderr.write(`leancheck: unexpected error: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 3;
  },
);
