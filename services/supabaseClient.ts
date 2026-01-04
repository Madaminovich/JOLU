
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dcxacwhhbewrneurcdxk.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjeGFjd2hoYmV3cm5ldXJjZHhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1NTMxNjUsImV4cCI6MjA4MzEyOTE2NX0.HdSeqSC12jg7XBjDZvfA28Z7kwsD9Q1XqSU0YjL9hoc';

export const supabase = createClient(supabaseUrl, supabaseKey);
