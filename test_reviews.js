const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://uqcjajmqtlchftpqwsrp.supabase.co";
const SUPABASE_KEY = "sb_publishable_yWZiH8l1idY0QWGuj6p9sg_GqXPONGX"; // Assuming anon key from frontend
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function test() {
  const { data, error } = await supabase
    .from('reviews')
    .select(`
      *,
      technician:technician_id(name)
    `)
    .limit(1);

  if (error) {
    console.error("Error occurred:");
    console.error(error);
  } else {
    console.log("Success. Data:", data);
  }
}

test();
