import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import AdmZip from 'adm-zip';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        // Create a unique filename to avoid collisions
        const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const tempPath = path.join(os.tmpdir(), fileName);

        fs.writeFileSync(tempPath, buffer);

        // Inspect file content
        let detectedFiles: { name: string, size: number }[] = [];

        if (fileName.endsWith('.zip')) {
            try {
                const zip = new AdmZip(tempPath);
                const entries = zip.getEntries();
                detectedFiles = entries
                    .filter(e => !e.isDirectory && (e.entryName.endsWith('.qcow2') || e.entryName.endsWith('.img') || e.entryName.endsWith('.iso')))
                    .map(e => ({
                        name: e.entryName,
                        size: e.header.size // Uncompressed size
                    }));
            } catch (e) {
                console.error("Failed to read zip content", e);
                // Non-fatal, just behave as single file or empty
            }
        } else {
            detectedFiles = [{
                name: fileName,
                size: file.size
            }];
        }

        return NextResponse.json({
            success: true,
            fileId: fileName,
            tempPath: tempPath,
            detectedFiles: detectedFiles
        });

    } catch (error: any) {
        console.error('Upload Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
