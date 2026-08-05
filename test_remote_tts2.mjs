const supabaseUrl = 'https://lngulewvpiegsuotabnt.supabase.co';
const supabaseKey = 'sb_publishable_ak-WLtZTbrgO3_CfswcwUQ_un7PsvEg';

async function testVoice(voice) {
  const res = await fetch(`${supabaseUrl}/functions/v1/tts-synthesize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseKey}`
    },
    body: JSON.stringify({ text: 'hello', voice, rate: '-10%' })
  });
  const text = await res.text();
  console.log(`${voice} status: ${res.status}, body: ${text}`);
}

async function run() {
  await testVoice('en-GB-SoniaNeural');
  await testVoice('en-US-EmmaMultilingualNeural');
  await testVoice('en-US-AriaNeural');
}

run();
