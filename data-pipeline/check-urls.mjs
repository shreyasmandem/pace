// Dev helper: print HTTP status (after redirects) for each URL argument.
const urls = process.argv.slice(2);
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36' };

for (const url of urls) {
  try {
    const res = await fetch(url, { headers: UA, redirect: 'follow' });
    console.log(res.status, res.url === url ? '' : `-> ${res.url}`, url);
  } catch (e) {
    console.log('ERR', e.message, url);
  }
}
