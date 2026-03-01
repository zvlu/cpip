// Legacy re-export — new code should import from @/lib/supabase/client or @/lib/supabase/server
import { createClient } from "@/lib/supabase/client";

// Browser-side singleton for backward compatibility
export const supabase = createClient();

export { createClient };
