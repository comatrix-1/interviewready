const baseUrl =
  process.env.BACKEND_URL ??
  'http://localhost:8000';

async function check(path) {
  const response = await fetch(`${baseUrl}${path}`);

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `${path} returned HTTP ${response.status}: ${text}`
    );
  }

  return response;
}

await check('/health');

console.log(`InterviewReady backend is healthy at ${baseUrl}`);