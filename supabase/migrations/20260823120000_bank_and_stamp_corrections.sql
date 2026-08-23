-- ============================================================================
-- Symanek Suite — banking correction + official stamp availability.
--   (Symanek response 2026-08-23: 2027 fee-structure document + stamp scan.)
--
--   • The 2027 fee structure confirms the EFT account is held under the name
--     "Symanek Specialized College" (an Enterprise Business Account), FNB
--     Okahandja, branch code 280373 — superseding the earlier admission-letter
--     template that read "Symanek Training Academy / Cheque". Correct the single
--     college_settings row so every generated document shows the right details.
--   • The official stamp is now available (extracted from the 18 Aug 2026 scan
--     and bundled as /stamp.png in the app). Letters render it automatically via
--     the bundled fallback; stamp_path is set here only when the college's
--     cleaner stamp image is uploaded to storage (leave the note for that swap).
--
-- Idempotent. Follows the pattern in 20260809120000_institution_and_grading.sql.
-- ============================================================================

update public.college_settings set
  bank_account_name = 'Symanek Specialized College',
  bank_account_type = 'Enterprise Business Account',
  bank_branch       = 'Okahandja (branch code 280373)',
  updated_at        = now()
where bank_account_name is distinct from 'Symanek Specialized College'
   or bank_account_type is distinct from 'Enterprise Business Account';

-- Stamp availability note: the app falls back to the bundled /stamp.png when
-- stamp_path is null, so no value is required here. When Symanek sends the
-- cleaner stamp image, upload it to the student-documents bucket and set:
--   update public.college_settings set stamp_path = '<public storage URL>';

notify pgrst, 'reload schema';
