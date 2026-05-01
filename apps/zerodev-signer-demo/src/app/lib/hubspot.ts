export async function submitToHubSpot(email: string, marketingConsent = true) {
  const portalId = process.env.NEXT_PUBLIC_HUBSPOT_PORTAL_ID
  const formId = process.env.NEXT_PUBLIC_HUBSPOT_FORM_ID

  if (!portalId || !formId) {
    console.warn('HubSpot: Missing portal ID or form ID')
    return
  }

  try {
    const response = await fetch(
      `https://api.hsforms.com/submissions/v3/integration/submit/${portalId}/${formId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: [
            { name: 'email', value: email },
            { name: 'marketing_consent', value: String(marketingConsent) },
          ],
        }),
      },
    )

    if (!response.ok) {
      console.error('HubSpot submission failed:', await response.text())
    }
  } catch (error) {
    console.error('HubSpot submission error:', error)
  }
}
