import "server-only";

import { cache as reactCache } from "react";

type RequestCacheFn = <T extends (...args: never[]) => unknown>(fn: T) => T;

/** React request dedupe in RSC; identity wrapper in vitest/non-React runtimes. */
export const requestCache: RequestCacheFn =
  typeof reactCache === "function" ? reactCache : (fn) => fn;
