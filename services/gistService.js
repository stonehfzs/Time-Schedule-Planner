const GIST_API_URL = 'https://api.github.com/gists';
const FILENAME = 'database.json';

const getGistCredentials = () => {
    return {
        pat: localStorage.getItem('gistPat'),
        id: localStorage.getItem('gistId'),
    };
};

const makeRequest = async (url, method = 'GET', body = null) => {
    const { pat } = getGistCredentials();
    if (!pat) {
        console.error("GitHub PAT not found.");
        return null;
    }

    const headers = {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${pat}`,
        'X-GitHub-Api-Version': '2022-11-28',
    };

    const options = {
        method,
        headers,
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            console.error(`GitHub API request failed: ${response.status} ${response.statusText}`);
            return null;
        }
        if (response.status === 204) { // No Content, for successful PATCH
            return true;
        }
        return await response.json();
    } catch (error) {
        console.error("Error making request to GitHub API:", error);
        return null;
    }
};

export const getGistData = async () => {
    const { id } = getGistCredentials();
    if (!id) return null;

    const gist = await makeRequest(`${GIST_API_URL}/${id}`);
    if (gist && gist.files && gist.files[FILENAME]) {
        try {
            return JSON.parse(gist.files[FILENAME].content);
        } catch (e) {
            console.error("Failed to parse Gist content:", e);
            // If content is invalid, return a default structure
            return { events: [], tasks: [] };
        }
    }
    return null;
};

export const saveGistData = async (data) => {
    const { id } = getGistCredentials();
    if (!id) return;

    const body = {
        files: {
            [FILENAME]: {
                content: JSON.stringify(data, null, 2), // Pretty print JSON
            },
        },
    };

    await makeRequest(`${GIST_API_URL}/${id}`, 'PATCH', body);
};

export const verifyGistCredentials = async (pat, id) => {
    if (!pat || !id) return false;

    // We can't use makeRequest here because it relies on localStorage
    const headers = {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${pat}`,
        'X-GitHub-Api-Version': '2022-11-28',
    };

    try {
        const response = await fetch(`${GIST_API_URL}/${id}`, { headers });
        return response.ok;
    } catch (error) {
        console.error("Error verifying Gist credentials:", error);
        return false;
    }
};