/**
 * The pure rules behind the create / edit / delete dialogs of Users & Roles (RB-9 as amended
 * 02-11-2026: `createUser`, `updateUser` and `deleteUser` need the vendor `root` account on top of
 * `USER_ADMIN`). No React, no I/O, so a test can read the bounds without a page.
 *
 * The bounds are the contract's own (`api/administration.ts`: `OPERATOR_USERNAME_PATTERN`,
 * `OPERATOR_NAME_MAX_LENGTH`, `OPERATOR_INITIALS_MAX_LENGTH`, the 24 of `rank`) and are checked here
 * only to say something before a round trip. The server's 422 stays the judge (F59): what passes
 * here and is still refused shows as the dialog's inline sentence.
 *
 * | Rule | Function |
 * |------|----------|
 * | What the fields must hold before a press is allowed | `validateCreate`, `validateEdit`, `validateDelete` |
 * | The body of `createUser` | `createUserBody` |
 * | The body of `updateUser`: only what differs, `rank: null` to clear it | `updateUserBody`, `profileChanged` |
 * | The body of `deleteUser` | `deleteUserBody` |
 * | The row as an editable draft | `draftOf` |
 */
import {
  ADMIN_REASON_MAX_LENGTH,
  OPERATOR_INITIALS_MAX_LENGTH,
  OPERATOR_NAME_MAX_LENGTH,
  OPERATOR_USERNAME_PATTERN,
  type AdminUser,
  type CreateUserRequest,
  type DeleteUserRequest,
  type UpdateUserRequest,
} from '@dems/shared/api'
import type { OperatorRole } from '@dems/shared/sim'

/** The bound `rank` carries in `CreateUserRequestSchema` / `UpdateUserRequestSchema` (no shared name exists). */
export const OPERATOR_RANK_MAX_LENGTH = 24

/** The bound of `usernameField()` (`OPERATOR_USERNAME_PATTERN` allows 1 + 63 characters); no shared name exists. */
export const OPERATOR_USERNAME_MAX_LENGTH = 64

/** The five text fields of the create and edit dialogs, held as the operator typed them. */
export interface ProfileDraft {
  readonly username: string
  readonly name: string
  readonly displayName: string
  readonly initials: string
  readonly rank: string
}

/** The empty form of "Add user". Nothing is pre-filled from another row. */
export const EMPTY_DRAFT: ProfileDraft = { username: '', name: '', displayName: '', initials: '', rank: '' }

/** An existing row as an editable draft; the optional fields start empty when the row has none. */
export function draftOf(user: AdminUser): ProfileDraft {
  return {
    username: user.username,
    name: user.name,
    displayName: user.displayName === user.name ? '' : user.displayName,
    initials: user.initials,
    rank: user.rank ?? '',
  }
}

/** The field that can be wrong in one of the dialogs. */
export type ProfileField = 'username' | 'name' | 'displayName' | 'initials' | 'rank' | 'confirm'

/** The reason a field is wrong, worded by the dialog through `usersRoles.fields.errors.*`. */
export type FieldProblem = 'required' | 'username' | 'name' | 'initials' | 'rank' | 'usernameTaken' | 'confirmMismatch'

export type FieldErrors = Partial<Record<ProfileField, FieldProblem>>

/** The username as the server stores it: trimmed and lower-cased (`usernameField().overwrite`). */
export const normalizeUsername = (value: string): string => value.trim().toLowerCase()

/** The initials as the server stores them: trimmed and upper-cased (`initialsField().overwrite`). */
export const normalizeInitials = (value: string): string => value.trim().toUpperCase()

const blank = (value: string): boolean => value.trim() === ''

/** The problems of the create form. `takenUsernames` are the usernames of the current list, normalized. */
export function validateCreate(draft: ProfileDraft, takenUsernames: readonly string[] = []): FieldErrors {
  const errors: FieldErrors = {}
  const username = normalizeUsername(draft.username)
  if (blank(draft.username)) errors.username = 'required'
  else if (!OPERATOR_USERNAME_PATTERN.test(username)) errors.username = 'username'
  else if (takenUsernames.includes(username)) errors.username = 'usernameTaken'
  if (blank(draft.name)) errors.name = 'required'
  else if (draft.name.trim().length > OPERATOR_NAME_MAX_LENGTH) errors.name = 'name'
  if (blank(draft.displayName)) {
    // Optional: the server uses the full name when the body carries no display name.
  } else if (draft.displayName.trim().length > OPERATOR_NAME_MAX_LENGTH) errors.displayName = 'name'
  if (blank(draft.initials)) errors.initials = 'required'
  else if (normalizeInitials(draft.initials).length > OPERATOR_INITIALS_MAX_LENGTH) errors.initials = 'initials'
  if (!blank(draft.rank) && draft.rank.trim().length > OPERATOR_RANK_MAX_LENGTH) errors.rank = 'rank'
  return errors
}

/**
 * The problems of the edit form. The username is not a field of `updateUser` — it is what the delete
 * dialog repeats — so it is never validated or sent here.
 */
export function validateEdit(draft: ProfileDraft): FieldErrors {
  const errors: FieldErrors = {}
  if (blank(draft.name)) errors.name = 'required'
  else if (draft.name.trim().length > OPERATOR_NAME_MAX_LENGTH) errors.name = 'name'
  if (!blank(draft.displayName) && draft.displayName.trim().length > OPERATOR_NAME_MAX_LENGTH) errors.displayName = 'name'
  if (blank(draft.initials)) errors.initials = 'required'
  else if (normalizeInitials(draft.initials).length > OPERATOR_INITIALS_MAX_LENGTH) errors.initials = 'initials'
  if (!blank(draft.rank) && draft.rank.trim().length > OPERATOR_RANK_MAX_LENGTH) errors.rank = 'rank'
  return errors
}

/** Whether the typed confirmation is the username of the account (the body's `confirm`). */
export function validateDelete(target: AdminUser, confirm: string): FieldErrors {
  return confirm.trim() === target.username ? {} : { confirm: 'confirmMismatch' }
}

/** True when the edit draft differs from the row: the confirm of the dialog waits for this. */
export function profileChanged(before: AdminUser, draft: ProfileDraft): boolean {
  return updateUserBody(before, draft) !== null
}

/** The body of `createUser`: trimmed, normalized, with the optional members left out when empty. */
export function createUserBody(draft: ProfileDraft, role: OperatorRole, password: string, reason: string): CreateUserRequest {
  const name = draft.name.trim()
  const displayName = draft.displayName.trim()
  const rank = draft.rank.trim()
  const initialPassword = password.trim()
  const trimmedReason = reason.trim().slice(0, ADMIN_REASON_MAX_LENGTH)
  return {
    username: normalizeUsername(draft.username),
    name,
    ...(displayName === '' || displayName === name ? {} : { displayName }),
    initials: normalizeInitials(draft.initials),
    ...(rank === '' ? {} : { rank }),
    role,
    ...(initialPassword === '' ? {} : { password: initialPassword }),
    ...(trimmedReason === '' ? {} : { reason: trimmedReason }),
  }
}

/**
 * The body of `updateUser`, or `null` when the draft holds no change at all — the schema refuses an
 * empty profile ("Name at least one field to change"), so the dialog disables its confirm instead.
 * A cleared `rank` is sent as `null`, which is how the contract says "no rank".
 */
export function updateUserBody(before: AdminUser, draft: ProfileDraft, reason = ''): UpdateUserRequest | null {
  const body: UpdateUserRequest = {}
  const name = draft.name.trim()
  const displayName = draft.displayName.trim()
  const initials = normalizeInitials(draft.initials)
  const rank = draft.rank.trim()
  if (name !== '' && name !== before.name) Object.assign(body, { name })
  // An empty display name means "keep what the row holds" (the hint of the field).
  if (displayName !== '' && displayName !== before.displayName) Object.assign(body, { displayName })
  if (initials !== '' && initials !== before.initials) Object.assign(body, { initials })
  if (rank !== (before.rank ?? '')) Object.assign(body, { rank: rank === '' ? null : rank })
  const trimmedReason = reason.trim().slice(0, ADMIN_REASON_MAX_LENGTH)
  if (Object.keys(body).length === 0) return null
  return trimmedReason === '' ? body : { ...body, reason: trimmedReason }
}

/** The body of `deleteUser`: the repeated username, trimmed, and the reason when there is one. */
export function deleteUserBody(confirm: string, reason: string): DeleteUserRequest {
  const trimmedReason = reason.trim().slice(0, ADMIN_REASON_MAX_LENGTH)
  return { confirm: confirm.trim(), ...(trimmedReason === '' ? {} : { reason: trimmedReason }) }
}
