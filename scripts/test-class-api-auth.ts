const baseUrl = process.env.CLASS_API_TEST_BASE_URL ?? "http://127.0.0.1:5000";

async function main() {
	await expectStatus("unauthenticated class list", "/api/v1/classes", {
		method: "GET",
	}, 401);

	const loginResponse = await fetch(`${baseUrl}/api/v1/auth/demo-login`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ username: "teacher", password: "123456" }),
	});
	const loginBody = await loginResponse.text();
	if (loginResponse.status !== 200) {
		throw new Error(`demo teacher login expected 200, got ${loginResponse.status}: ${loginBody}`);
	}

	const cookie = loginResponse.headers.get("set-cookie")?.split(";")[0];
	if (!cookie) {
		throw new Error("demo teacher login did not return a session cookie");
	}

	await expectStatus("demo teacher formal class write isolation", "/api/v1/classes", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			cookie,
		},
		body: JSON.stringify({ name: "Demo formal isolation check" }),
	}, 403);
}

async function expectStatus(
	label: string,
	path: string,
	init: RequestInit,
	expectedStatus: number,
) {
	const response = await fetch(`${baseUrl}${path}`, init);
	const body = await response.text();
	if (response.status !== expectedStatus) {
		throw new Error(`${label} expected ${expectedStatus}, got ${response.status}: ${body}`);
	}
	console.log(`${label}: ${response.status}`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});

export {};
