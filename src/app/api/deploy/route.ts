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
    node: string
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

        console.log('SFTP Upload done. Running importdisk...');

        const cmd = `qm importdisk ${vmid} ${remotePath} ${storage}`;
        const result = await ssh.execCommand(cmd);

        if (result.code !== 0) {
            throw new Error(`qm importdisk failed: ${result.stderr}`);
        }

        console.log('Import Disk Successful. Attaching...');

        const attachCmd = `qm set ${vmid} --scsi0 ${storage}:0,import-from=${remotePath} --boot order=scsi0`;

        const attachRes = await ssh.execCommand(attachCmd);

        // Always cleanup remote temp
        await ssh.execCommand(`rm ${remotePath}`);

        if (attachRes.code !== 0) {
            throw new Error(`qm set failed: ${attachRes.stderr}`);
        }

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
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const vmConfigRaw = formData.get('vmConfig');

        // Authentication headers
        const host = req.headers.get('x-proxmox-host');
        const token = req.headers.get('x-proxmox-token');
        const node = req.headers.get('x-proxmox-node') || 'pve';

        // SSH Auth headers
        const sshHost = req.headers.get('x-proxmox-ssh-host');
        const sshUser = req.headers.get('x-proxmox-ssh-username');
        const sshPass = req.headers.get('x-proxmox-ssh-password');

        if (!host || !token || !vmConfigRaw || !file) {
            return NextResponse.json({ error: 'Missing configuration, auth, or file' }, { status: 401 });
        }

        const vmConfig = JSON.parse(vmConfigRaw as string);
        console.log(`Starting deployment for VM ${vmConfig.vmid} (${vmConfig.name})`);

        // 1. Prepare Disk Images
        const filesToUpload: { name: string, buffer: Buffer }[] = [];
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (file.name.endsWith('.zip')) {
            console.log("Processing ZIP file...");
            const zip = new AdmZip(buffer);
            const zipEntries = zip.getEntries();
            zipEntries.forEach((entry) => {
                if (!entry.isDirectory && (entry.entryName.endsWith('.qcow2') || entry.entryName.endsWith('.img') || entry.entryName.endsWith('.iso'))) {
                    filesToUpload.push({
                        name: entry.entryName,
                        buffer: entry.getData()
                    });
                }
            });
            if (filesToUpload.length === 0) throw new Error("No valid disk images (.qcow2, .img, .iso) found in zip");
        } else {
            filesToUpload.push({
                name: file.name,
                buffer: buffer
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

        console.log(`Creating VM at ${createUrl}...`);
        try {
            await axios.post(createUrl, createParams.toString(), { headers: apiHeaders, httpsAgent: agent });
        } catch (e: any) {
            if (e.response?.data?.errors?.vmid) {
                console.log("VM ID exists, attempting to continue...");
            } else {
                throw new Error(`VM Creation Failed via API: ${e.message}`);
            }
        }

        // 3. Upload & Import (Strategy Selection)
        if (sshHost && sshUser && sshPass) {
            console.log("SSH Credentials found. Using SSH Strategy for Upload/Import...");
            const sshConfig = { host: sshHost, user: sshUser, pass: sshPass };

            for (const f of filesToUpload) {
                const cleanName = f.name.replace(/[^a-zA-Z0-9.-]/g, '_');
                await uploadAndImportViaSSH(sshConfig, f.buffer, cleanName, vmConfig.vmid, vmConfig.storage, node);
            }
        } else {
            console.log("No SSH Credentials. Using API Strategy (Backup)...");
            const isoStorage = await findIsoStorage(host, node, token);

            for (const f of filesToUpload) {
                const cleanName = f.name.replace(/[^a-zA-Z0-9.-]/g, '_');
                const uploadUrl = `${host}/api2/json/nodes/${node}/storage/${isoStorage}/upload`;

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

                const volid = `${isoStorage}:iso/${cleanName}`;
                const configUrl = `${host}/api2/json/nodes/${node}/qemu/${vmConfig.vmid}/config`;
                const configParams = new URLSearchParams();
                configParams.append(`scsi0`, `${vmConfig.storage}:0,import-from=${volid}`);
                configParams.append('boot', `order=scsi0`);
                await axios.post(configUrl, configParams.toString(), { headers: apiHeaders, httpsAgent: agent });
            }
        }

        return NextResponse.json({
            success: true,
            message: "VM Created and Disks Imported successfully."
        });

    } catch (error: any) {
        console.error('Deploy Error:', error);
        return NextResponse.json({
            error: error.message,
            details: error.response?.data || 'Check Proxmox logs'
        }, { status: 500 });
    }
}
