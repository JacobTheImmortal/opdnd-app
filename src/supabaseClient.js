import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://YOUR_PROJECT.supabase.co';
const supabaseKey = 'your_anon_key';

export const supabase = createClient(supabaseUrl, supabaseKey);
