export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, X-Todoist-Token, X-Todoist-Method, X-Todoist-Path',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      },
      body: '',
    }
  }

  const token   = event.headers['x-todoist-token']
  const method  = event.headers['x-todoist-method'] || event.httpMethod
  const apiPath = event.headers['x-todoist-path']

  if (!token) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Missing Todoist token' }) }
  }
  if (!apiPath) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing API path' }) }
  }

  try {
    const response = await fetch(`https://api.todoist.com/rest/v2${apiPath}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: method !== 'GET' && event.body ? event.body : undefined,
    })

    if (response.status === 204) {
      return {
        statusCode: 204,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: '',
      }
    }

    const data = await response.json()
    return {
      statusCode: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(data),
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    }
  }
}
