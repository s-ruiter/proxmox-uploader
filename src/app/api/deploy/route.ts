import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import https from 'https';
import AdmZip from 'adm-zip';
import FormData from 'form-data';
import { NodeSSH } from 'node-ssh';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const agent = new https.Agent({ rejectUnauthorized: false });

// Helper to find a storage that supports 'iso' (content types) for uploading the temp file
async function findIsoStorage(host: string, node: string, token: string) {
    try {
        const res = await axios.get(`${host}/api2/json/nodes/${node}/storage`, {
            headers: { 'Authorization': `PVEAPIToken=${token}` },
            httpsAgent: agent
        });
        const storage = res.data.data.find((s: any) =>
            s.active && s.content && s.content.includes('iso')
        );
        return storage ? storage.storage : 'local';
    } catch (e) {
        console.error("Failed to find ISO storage, defaulting to local");
        return 'local';
    }
}

async function uploadAndImportViaSSH(
    sshConfig: { host: string, user: string, pass: string, port?: number },
    fileBuffer: Buffer,
    fileName: string,
    vmid: string,
    storage: string,
    node: string,
    diskIndex: number
) {
    const ssh = new NodeSSH();
    let tempLocalPath: string | undefined;

    try {
        console.log('Connecting to SSH...');
        await ssh.connect({
            host: sshConfig.host,
            username: sshConfig.user,
            password: sshConfig.pass,
            port: sshConfig.port || 22,
            readyTimeout: 20000
        });

        const remotePath = `/tmp/${fileName}`;
        console.log(`SFTP Uploading to ${remotePath}...`);

        tempLocalPath = path.join(os.tmpdir(), fileName);
        fs.writeFileSync(tempLocalPath, fileBuffer);

        await ssh.putFile(tempLocalPath, remotePath);

        console.log('SFTP Upload done. Running qm set import-from...');

        // Direct Attach (Atomic Import + Attach)
        // scsi${diskIndex} to avoid overwriting disks or boot order conflicts
        const attachCmd = `qm set ${vmid} --scsi${diskIndex} ${storage}:0,import-from=${remotePath}`;
        if (diskIndex === 0) {
            // Set boot order only for the first disk
            // Note: 'qm set' accepts multiple params
            // attachCmd += ` --boot order=scsi0`; // Actually stick to separate command or just this if supported
        }

        const result = await ssh.execCommand(attachCmd);

        // Cleanup remote file immediately
        await ssh.execCommand(`rm ${remotePath}`);

        if (result.code !== 0) {
            throw new Error(`qm set (import-from) failed: ${result.stderr}`);
        }

        // Set boot order if it's the first disk
        if (diskIndex === 0) {
            await ssh.execCommand(`qm set ${vmid} --boot order=scsi0`);
        }

        console.log(`Disk scsi${diskIndex} attached successfully.`);

    } catch (e) {
        throw e;
    } finally {
        if (tempLocalPath && fs.existsSync(tempLocalPath)) {
            fs.unlinkSync(tempLocalPath);
        }
        if (ssh.isConnected()) {
            ssh.dispose();
        }
    }
}

export async function POST(req: NextRequest) {
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    const writeLog = async (msg: string) => {
        console.log(msg); // Keep server logs too
        await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'log', message: msg })}\n\n`));
    };

    (async () => {
        // Cleaning up temp file at the end
        let tempFilePath: string | null = null;

        try {
            const body = await req.json();
            const { fileId, vmConfig } = body;

            // Authentication headers
            const host = req.headers.get('x-proxmox-host');
            const token = req.headers.get('x-proxmox-token');
            const node = req.headers.get('x-proxmox-node') || 'pve';

            // SSH Auth headers
            const sshHost = req.headers.get('x-proxmox-ssh-host');
            const sshUser = req.headers.get('x-proxmox-ssh-username');
            const sshPass = req.headers.get('x-proxmox-ssh-password');

            if (!host || !token || !vmConfig || !fileId) {
                await writeLog('Error: Missing configuration, auth, or fileId');
                throw new Error('Missing configuration, auth, or fileId');
            }

            const fileName = fileId as string; // This is the ID/Filename from /api/upload
            tempFilePath = path.join(os.tmpdir(), fileName);

            if (!fs.existsSync(tempFilePath)) {
                throw new Error('File not found. Please upload again.');
            }

            await writeLog(`Starting deployment for VM ${vmConfig.vmid} (${vmConfig.name})`);
            await writeLog(`Reading file from ${tempFilePath}...`);

            // 1. Prepare Disk Images
            // Now using 'diskOrder' if provided to map names to sequence
            const diskOrder = body.diskOrder as string[]; // optional

            const filesToUpload: { name: string, buffer: Buffer }[] = [];
            const fileBuffer = fs.readFileSync(tempFilePath);

            // Checking if zip based on original logic logic
            if (fileName.endsWith('.zip')) {
                await writeLog("Processing ZIP file...");
                const zip = new AdmZip(fileBuffer);
                const zipEntries = zip.getEntries();

                // Get all valid entries first
                const validEntries = zipEntries.filter(entry =>
                    !entry.isDirectory && (entry.entryName.endsWith('.qcow2') || entry.entryName.endsWith('.img') || entry.entryName.endsWith('.iso'))
                );

                if (diskOrder && diskOrder.length > 0) {
                    await writeLog("Using custom disk order...");
                    // Sort based on diskOrder
                    diskOrder.forEach(imgName => {
                        const entry = validEntries.find(e => e.entryName === imgName);
                        if (entry) {
                            filesToUpload.push({ name: entry.entryName, buffer: entry.getData() });
                        }
                    });

                    // Add any remaining valid files that weren't in diskOrder (just in case)
                    validEntries.forEach(entry => {
                        if (!diskOrder.includes(entry.entryName)) {
                            filesToUpload.push({ name: entry.entryName, buffer: entry.getData() });
                        }
                    });
                } else {
                    // Fallback to alphabetical if no order provided
                    validEntries.sort((a, b) => a.entryName.localeCompare(b.entryName));
                    validEntries.forEach(entry => {
                        filesToUpload.push({ name: entry.entryName, buffer: entry.getData() });
                    });
                }

                if (filesToUpload.length === 0) throw new Error("No valid disk images (.qcow2, .img, .iso) found in zip");
                await writeLog(`Found ${filesToUpload.length} images in ZIP.`);
            } else {
                filesToUpload.push({
                    name: fileName,
                    buffer: fileBuffer
                });
            }

            // 2. Create VM (Empty)
            const createUrl = `${host}/api2/json/nodes/${node}/qemu`;
            const createParams = new URLSearchParams();
            createParams.append('vmid', vmConfig.vmid);
            createParams.append('name', vmConfig.name);
            createParams.append('memory', vmConfig.memory);
            createParams.append('cores', vmConfig.cores);
            createParams.append('net0', 'virtio,bridge=vmbr0,firewall=1');
            createParams.append('scsihw', 'virtio-scsi-pci');
            createParams.append('ostype', 'l26');

            const apiHeaders = {
                'Authorization': `PVEAPIToken=${token}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            };

            await writeLog(`Creating VM at ${createUrl}...`);
            try {
                await axios.post(createUrl, createParams.toString(), { headers: apiHeaders, httpsAgent: agent });
                await writeLog('VM Created successfully.');
            } catch (e: any) {
                if (e.response?.data?.errors?.vmid) {
                    await writeLog("VM ID exists, attempting to continue...");
                } else {
                    throw new Error(`VM Creation Failed via API: ${e.message}`);
                }
            }

            // 3. Upload & Import (Strategy Selection)
            if (sshHost && sshUser && sshPass) {
                await writeLog("SSH Credentials found. Using SSH Strategy...");
                const sshConfig = { host: sshHost, user: sshUser, pass: sshPass };

                // Loop with Index
                for (let i = 0; i < filesToUpload.length; i++) {
                    const f = filesToUpload[i];
                    const cleanName = f.name.substring(f.name.lastIndexOf('/') + 1).replace(/[^a-zA-Z0-9.-]/g, '_'); // basename only
                    await writeLog(`Processing Disk ${i + 1}/${filesToUpload.length}: ${cleanName}...`);

                    await uploadAndImportViaSSH(sshConfig, f.buffer, cleanName, vmConfig.vmid, vmConfig.storage, node, i);
                    await writeLog(`Finished ${cleanName}.`);
                }
            } else {
                await writeLog("No SSH Credentials. Using API Strategy (Backup)...");
                const isoStorage = await findIsoStorage(host, node, token);

                for (let i = 0; i < filesToUpload.length; i++) {
                    const f = filesToUpload[i];
                    const cleanName = f.name.substring(f.name.lastIndexOf('/') + 1).replace(/[^a-zA-Z0-9.-]/g, '_');
                    const uploadUrl = `${host}/api2/json/nodes/${node}/storage/${isoStorage}/upload`;

                    await writeLog(`Uploading ${cleanName} to ${isoStorage}...`);

                    const form = new FormData();
                    form.append('content', 'iso');
                    form.append('filename', cleanName);
                    form.append('file', f.buffer, { filename: cleanName });

                    const upRes = await axios.post(uploadUrl, form, {
                        headers: { 'Authorization': `PVEAPIToken=${token}`, ...form.getHeaders() },
                        httpsAgent: agent,
                        maxBodyLength: Infinity,
                        maxContentLength: Infinity
                    });

                    if (upRes.status !== 200) throw new Error(`API Upload Failed: ${upRes.status}`);
                    await writeLog(`Upload complete. Attaching to VM (scsi${i})...`);

                    const volid = `${isoStorage}:iso/${cleanName}`;
                    const configUrl = `${host}/api2/json/nodes/${node}/qemu/${vmConfig.vmid}/config`;
                    const configParams = new URLSearchParams();
                    // Attach to scsi{i}
                    configParams.append(`scsi${i}`, `${vmConfig.storage}:0,import-from=${volid}`);
                    if (i === 0) {
                        configParams.append('boot', `order=scsi0`);
                    }
                    await axios.post(configUrl, configParams.toString(), { headers: apiHeaders, httpsAgent: agent });
                    await writeLog(`Attached ${cleanName} as scsi${i}.`);
                }
            }

            await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'done', success: true, message: 'Deployment Complete' })}\n\n`));

        } catch (error: any) {
            console.error('Deploy Error:', error);
            await writer.write(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`));
        } finally {
            // Clean up the uploaded file
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                try {
                    fs.unlinkSync(tempFilePath);
                    console.log('Cleaned up temp file');
                } catch (e) {
                    console.error('Failed to cleanup temp file', e);
                }
            }
            await writer.close();
        }
    })();

    return new NextResponse(stream.readable, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
