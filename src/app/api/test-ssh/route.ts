import { NextResponse } from 'next/server';
import { NodeSSH } from 'node-ssh';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { host, username, password } = body;

        if (!host || !username || !password) {
            return NextResponse.json({ success: false, error: 'Missing SSH credentials' }, { status: 400 });
        }

        const ssh = new NodeSSH();

        // Set a timeout for the connection attempt
        await Promise.race([
            ssh.connect({
                host,
                username,
                password,
                readyTimeout: 5000, // 5 seconds timeout
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out')), 5000))
        ]);

        await ssh.dispose();

        return NextResponse.json({ success: true, message: 'SSH Connection Successful' });

    } catch (error: any) {
        console.error("SSH Test Error:", error);
        return NextResponse.json({ success: false, error: error.message || 'SSH Connection Failed' }, { status: 500 });
    }
}
