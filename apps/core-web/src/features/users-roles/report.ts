/**
 * The Users & Roles page's own log reporter (plan row W77; W0 §15, decision D165): the console's
 * one helper `createPageReporter` from `@/lib/page-report`, bound once to the prefix `usr`.
 *
 * Called only for the branch the refusal presenter left to the page (a 404, an answer the presenter
 * does not word). The record holds the caller's fixed sentence, the cause by its class, code and
 * status, and non-secret facts (an operator ID, an operation ID). Never the reason an
 * administrator typed, never the text of an error.
 */
import { createPageReporter } from '@/lib/page-report'

const page = createPageReporter('usr')

export const reportUsersError = page.report
export const newUsersCorrelationId = page.newCorrelationId
