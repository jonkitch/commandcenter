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
  const method  = (event.headers['x-todoist-method'] || 'GET').toUpperCase()
  const apiPath = event.headers['x-todoist-path']

  if (!token || !apiPath) {
    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: `Missing required headers. token=${!!token} path=${!!apiPath}` }),
    }
  }

  try {
    const fetchOptions = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }

    if (method !== 'GET' && method !== 'DELETE' && event.body) {
      fetchOptions.body = event.body
    }

    const response = await fetch(
      `https://api.todoist.com/rest/v2${apiPath}`,
      fetchOptions
    )

    if (response.status === 204) {
      return {
        statusCode: 204,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: '',
      }
    }

    const text = await response.text()
    return {
      statusCode: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: text,
    }
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message, stack: err.stack }),
    }
  }
}
