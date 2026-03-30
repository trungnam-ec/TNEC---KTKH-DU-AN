fetch('http://localhost:3000/api/supabase/settings', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ openai_api_key: 'test', ai_model: 'gpt-4o-mini', system_prompt: 'test test' })
})
.then(res => res.text())
.then(data => console.log(data))
.catch(err => console.error(err));
