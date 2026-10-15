const baseUrl = process.env.AUTH_TEST_BASE_URL ?? "http://127.0.0.1:5000";
const username = process.env.AUTH_TEST_USERNAME ?? process.env.BOOTSTRAP_ADMIN_USERNAME;
const password = process.env.AUTH_TEST_PASSWORD ?? process.env.BOOTSTRAP_ADMIN_PASSWORD;

async function main() {
  if (!username || !password) {
    throw new Error("Set AUTH_TEST_USERNAME/AUTH_TEST_PASSWORD or BOOTSTRAP_ADMIN_USERNAME/BOOTSTRAP_ADMIN_PASSWORD.");
  }

  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const body = await response.json().catch(() => null);
  const setCookie = response.headers.get("set-cookie");

  if (!response.ok || !body?.success || !setCookie?.includes("ai_roboedu_session=")) {
    console.error(JSON.stringify(body, null, 2));
    throw new Error(`Login test failed with HTTP ${response.status}.`);
  }

  const meResponse = await fetch(`${baseUrl}/api/v1/auth/me`, {
    headers: { Cookie: setCookie },
  });
  const meBody = await meResponse.json().catch(() => null);

  if (!meResponse.ok || !meBody?.success) {
    console.error(JSON.stringify(meBody, null, 2));
    throw new Error(`Session test failed with HTTP ${meResponse.status}.`);
  }

  console.log("Auth login test passed:");
  console.log(JSON.stringify(meBody.data, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

export {};
