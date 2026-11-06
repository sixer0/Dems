-- Custom SQL migration file, put your code below! --
-- 0021_profile_codes_data (hand-written; task 4, the element CHECK on capture_devices.profiles,
-- contract revision dbc-11; requirement AD-06 (4) of verification/04_security_addendum.md, handed
-- over by row 51 and deferred by row 17; decisions C29 (2), C36). Migration set 11:
-- this file (the data step), 0022 (generated: the CHECK), 0023 (hand-written: the version step).
--
-- No statement names the owner role or the provisioning superuser (MG-9, OW-9).
--
-- WHY A DATA STEP, AND WHY IT IS A FILE OF ITS OWN. 0022 adds a CHECK that holds every element of
-- the profile list to the code form of the Core. ADD CONSTRAINT validates the stored rows, so a
-- database that holds a list of another form would refuse the whole set. Such rows exist: until
-- row 51 adoption stored the camera's own ONVIF profile tokens as the list (for example
-- ["profile_1"]). The step must run BEFORE the CHECK and the generated file is not edited by
-- hand, so the step stands here, one file earlier in the same transaction.
--
-- THE RULE, taken conservatively. A row whose list does not satisfy the CHECK of 0022 gets the
-- EMPTY list. Nothing is translated and nothing is guessed: a token is not a code, no stream row
-- says what it meant (capture_device_streams is written from row 51 on), and no default profile
-- may stand in for a production camera (decision C36). The empty list is what adoption stores
-- today when no stream half ran; the camera keeps its row, its address, its credential and its
-- place in the registry, and needs ONE connection test before it can be assigned again.
-- The whole list goes, not single elements: a list with one foreign element was not written by
-- the code that mints codes, so none of its elements is known to be one.
-- The predicate is the negation of the CHECK, letter for letter (the CASE branch for something
-- that is no array cannot be met: capture_devices_profiles_check has held since 0004).
--
-- NOT TOUCHED: any row whose list already satisfies the CHECK (every seeded, simulated and
-- development device: their profiles are codes), capture_config (the selector keeps what it
-- names), capture_device_streams, and every other column of capture_devices.
-- An exception to MG-8 ("no migration rewrites a stored row"), stated as one: without it the set
-- cannot be applied to a database a Core adopted a camera on before row 51.
UPDATE public.capture_devices
   SET profiles = '[]'::jsonb
 WHERE jsonb_typeof(profiles) = 'array'
   AND jsonb_path_exists(profiles, 'strict $[*]?(@.type() != "string" || !(@ like_regex "^[A-Z][A-Z0-9_]{0,63}$"))');