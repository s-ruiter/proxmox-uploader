import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import https from 'https';

// Create an axios instance that ignores self-signed certs
const agent = new https.Agent({
    rejectUnauthorized: false
});

const client = axios.create({
    httpsAgent: agent,
    validateStatus: () => true // Handle errors manually
});

async function handler(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    // Await the params object
    const { path } = await params;

    // Get config from headers
    const host = req.headers.get('x-proxmox-host');
    const token = req.headers.get('x-proxmox-token'); // Format: user@pam!token=uuid
    // Or user/pass

    if (!host || !token) {
        return NextResponse.json({ error: 'Missing configuration headers' }, { status: 401 });
    }

    const pathStr = path.join('/');
    const url = `${host}/api2/json/${pathStr}`;

    try {
        const method = req.method as string;
        const body = method === 'POST' || method === 'PUT' ? await req.json().catch(() => null) : null;

        const response = await client({
            method: method,
            url: url,
            headers: {
                'Authorization': `PVEAPIToken=${token}`,
                'Content-Type': 'application/x-www-form-urlencoded' // Proxmox often wants this or json
            },
            data: body
        });

        return NextResponse.json(response.data, { status: response.status });

    } catch (error: any) {
        console.error('Proxy Error:', error.message);
        return NextResponse.json({ error: 'Proxy failed', details: error.message }, { status: 500 });
    }
}

export { handler as GET, handler as POST, handler as PUT, handler as DELETE };
