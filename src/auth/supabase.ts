import { createClient } from '@supabase/supabase-js'

// For now: the Fleet app's (Vehicle Management System) Supabase project and its accounts.
// The publishable key is meant for browsers; access is enforced by sign-in and the server function.
export const supabase = createClient(
  'https://gcazhqwydpiidnhtczfc.supabase.co',
  'sb_publishable_QzB3C42HLpG_-f1-3L67Hw_DRL6Fbpo',
)

export interface SignedInUser {
  email: string
}
