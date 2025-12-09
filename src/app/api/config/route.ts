
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const CONFIG_FILE = path.join(process.cwd(), 'proxmox-config.json');

export async function GET() {
    try {
        const data = await fs.readFile(CONFIG_FILE, 'utf-8');
        return NextResponse.json({ success: true, config: JSON.parse(data) });
    } catch (error) {
        // File might not exist, which is fine
        return NextResponse.json({ success: false, config: null });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        // Simple validation or sanitation could go here
        await fs.writeFile(CONFIG_FILE, JSON.stringify(body, null, 2), 'utf-8');
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to save config:", error);
        return NextResponse.json({ success: false, error: 'Failed to save config' }, { status: 500 });
    }
}
