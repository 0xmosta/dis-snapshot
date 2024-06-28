import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get(`DB_URL`)!
const supabaseKey = Deno.env.get(`DB_KEY`)!
export const supabase = createClient(supabaseUrl, supabaseKey);