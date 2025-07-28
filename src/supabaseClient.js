import { createClient } from '@supabase/supabase-js'

const supabaseUrl = https://sgwvigofvsmbenujnpar.supabase.co;
const supabaseKey = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnd3ZpZ29mdnNtYmVudWpucGFyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NTc1NDksImV4cCI6MjA2OTAzMzU0OX0.M7aMKjfLlFGsgQlLRDl38IhlEStfP6EkGx9DKJWh7pQ;

export const supabase = createClient(supabaseUrl, supabaseKey);
