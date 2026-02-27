/**
 * Creates a test project via the backend's dev-mode project creation endpoint.
 *
 * @param backendUrl - The backend base URL (e.g. http://localhost:7082/api/v1)
 * @param secret - The API secret for project creation
 * @returns The created project's ID
 */
export async function createTestProject(
  backendUrl: string,
  secret: string,
): Promise<{ projectId: string }> {
  const res = await fetch(`${backendUrl}/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      apiKey: secret,
      name: `e2e-test-${Date.now()}`,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Failed to create test project: ${res.status} ${text}`)
  }

  const data = await res.json()
  return { projectId: data.id ?? data.projectId }
}
