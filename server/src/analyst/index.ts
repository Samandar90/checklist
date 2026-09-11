/*
 * Local analyst — a dependency-free "ask your data" engine.
 *
 *   import { Analyst } from "./analyst";
 *   const analyst = new Analyst(config).load(facts);
 *   analyst.ask("почему упала выручка в сентябре?")   // → { text, intent, confidence, followUps }
 *   analyst.narrative()                               // → summary paragraph
 *   analyst.insights()                                // → ranked risks / opportunities from config.rules
 *
 * See README.md in this folder for how to describe a new domain.
 */

export { Analyst } from "./engine";
export type { AskOptions } from "./engine";
export * from "./core/types";
export { Dataset, BUILTIN_DIMENSIONS } from "./core/dataset";
export * as dates from "./core/dates";
export * as format from "./core/format";
export * as stats from "./core/stats";
export { parseQuestion } from "./nlu/parse";
export type { Query, ParseContext } from "./nlu/parse";
export { tokenize, stem, stemPhrase, findPhrase } from "./nlu/stem";
export { genericRules } from "./rules/generic";
